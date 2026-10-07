import { randomUUID } from "node:crypto";

import { hashExecutionJson, hashPreparedRun } from "@repo/models";
import { validatePortValues, validatePreparedGraph } from "@repo/pipeline-engine";
import {
  PreparedRunSchema,
  RunRequestInputSchema,
  type ExecutionPrincipal,
  type PreparedRun,
} from "@repo/schemas";

import { resolveNodeExecution } from "../../helpers/resolveNodeExecution";
import type { fingerprintExecutable } from "../../helpers/fingerprintExecutable";
import { inspectCodexCredentialRef } from "../../../executionPrompt/codexHome";
import {
  executionFailure,
  executionServiceResult,
  requireExecutionScope,
} from "../../helpers/serviceResult";

import { unwrap } from "../../helpers/preparationUnwrap";

import type { ExecutionPreparationServiceBindings } from "../../contracts";
export const createPreparationSubmitMethod = (
  serviceBindings: Pick<
    ExecutionPreparationServiceBindings,
    "repository" | "deps" | "pinnedOperations" | "fingerprint"
  >,
) =>
  ({
    submit(principalInput: ExecutionPrincipal, value: unknown) {
      return executionServiceResult(async () => {
        const principal = requireExecutionScope(principalInput, "execution:submit");
        const input = RunRequestInputSchema.parse(value);
        const inputHash = hashExecutionJson(input);
        const replay = await serviceBindings.repository.replayRunRequest(
          principal,
          input,
          inputHash,
        );
        if (replay) return replay;
        if (serviceBindings.deps.isAccepting && !serviceBindings.deps.isAccepting())
          executionFailure(
            "EXECUTION_DRAINING",
            "This application is shutting down; retry after it restarts",
          );
        const pipeline = await serviceBindings.repository.getPipeline(
          principal.workspaceId,
          input.pipelineId,
        );
        if (!pipeline) executionFailure("NOT_FOUND", "Pipeline was not found", "pipelineId");
        if (pipeline.revision !== input.expectedRevision)
          executionFailure(
            "REVISION_CONFLICT",
            "Pipeline changed; save and submit its current revision",
            "expectedRevision",
          );
        const operations = await (0, serviceBindings.pinnedOperations)(
          principal.workspaceId,
          pipeline.graph,
        );
        const settings = await serviceBindings.repository.getWorkspaceSettings(
          principal.workspaceId,
        );
        const needsAgent = operations.some((operation) => operation.executor.kind === "agent");
        const runtimes = needsAgent
          ? (await serviceBindings.repository.listRuntimeConfigs(principal.workspaceId)).map(
              (row) => row.config,
            )
          : [];
        const resolvedNodes: PreparedRun["resolvedNodes"] = {};
        const fingerprints = new Map<string, Awaited<ReturnType<typeof fingerprintExecutable>>>();
        for (const node of pipeline.graph.nodes) {
          const operation = operations.find(
            (entry) =>
              entry.id === node.operation.operationId && entry.revision === node.operation.revision,
          )!;
          const resolution = resolveNodeExecution({
            executorKind: operation.executor.kind,
            run: input.executionOverrides,
            node: node.executionOverrides,
            operation: operation.executionDefaults,
            settings: settings?.executionDefaults ?? {},
            runtimes,
          });
          if (resolution.isErr())
            executionFailure(
              resolution.error.code,
              resolution.error.message,
              `nodes.${node.id}.${resolution.error.field}`,
            );
          const resolved = resolution.value;
          if (resolved.executorKind === "agent" && resolved.agent !== "codex")
            executionFailure(
              "RUNTIME_UNSUPPORTED",
              "This release supports the local Codex prompt adapter",
              `nodes.${node.id}.runtimeConfigId`,
            );
          const executable =
            operation.executor.kind === "script"
              ? serviceBindings.deps.scriptExecutables[operation.executor.language]
              : resolved.executablePath;
          if (operation.executor.kind !== "builtin") {
            if (!executable)
              executionFailure(
                "EXECUTABLE_REQUIRED",
                "The selected interpreter is not configured",
                `nodes.${node.id}.executablePath`,
              );
            const cached =
              fingerprints.get(executable) ?? (await (0, serviceBindings.fingerprint)(executable));
            fingerprints.set(executable, cached);
            Object.assign(resolved, unwrap(cached));
          }
          resolvedNodes[node.id] = resolved;
        }
        const artifactIds = new Set(
          Object.values(input.inputs).flatMap((values) =>
            values.flatMap((item) => (item.kind === "artifact" ? [item.artifactId] : [])),
          ),
        );
        for (const operation of operations) {
          if (
            operation.executor.kind === "builtin" &&
            operation.executor.name === "materialize_file" &&
            typeof operation.executor.config["assetId"] === "string"
          )
            artifactIds.add(operation.executor.config["assetId"]);
        }
        const inputArtifacts: PreparedRun["inputArtifacts"] = [];
        for (const artifactId of artifactIds) {
          const snapshot = await serviceBindings.deps.artifactStore.getInputSnapshot(
            principal,
            artifactId,
          );
          if (snapshot.isErr()) throw snapshot.error;
          inputArtifacts.push(snapshot.value);
        }
        unwrap(
          await validatePortValues(pipeline.graph.inputs, input.inputs, async (id) => {
            const snapshot = inputArtifacts.find((entry) => entry.artifactId === id);

            return executionServiceResult(async () => {
              if (!snapshot)
                executionFailure(
                  "ARTIFACT_NOT_FOUND",
                  "Input artifact was not resolved",
                  id,
                  "artifact",
                );

              return {
                artifactId: snapshot.artifactId,
                mimeType: snapshot.mimeType,
                sizeBytes: snapshot.sizeBytes,
                sha256: snapshot.sha256,
              };
            });
          }),
        );
        const reasons = operations.flatMap((operation) =>
          operation.executor.kind === "script"
            ? [`${operation.name}: execute local script with this user's system permissions`]
            : operation.executor.kind === "agent"
              ? [`${operation.name}: send the prepared input to the configured model provider`]
              : [],
        );
        const prepared = PreparedRunSchema.parse({
          apiVersion: 2,
          id: randomUUID(),
          subjectId: principal.subjectId,
          workspaceId: principal.workspaceId,
          createdAt: new Date().toISOString(),
          pipeline,
          operations,
          resolvedNodes,
          inputs: input.inputs,
          inputArtifacts,
          deliveryRequirements: input.deliveryRequirements,
          credentialRefs: needsAgent
            ? [
                await (
                  serviceBindings.deps.inspectCodexCredentialRef ?? inspectCodexCredentialRef
                )(),
              ]
            : [],
          risk: { requiresApproval: reasons.length > 0, reasons },
          contentHash: "0".repeat(64),
        });
        prepared.contentHash = hashPreparedRun(prepared);
        unwrap(validatePreparedGraph(prepared));

        if (serviceBindings.deps.isAccepting && !serviceBindings.deps.isAccepting())
          executionFailure(
            "EXECUTION_DRAINING",
            "This application is shutting down; retry after it restarts",
          );

        return serviceBindings.repository.submitRun(
          principal,
          input,
          inputHash,
          prepared,
          serviceBindings.deps.approvalTtlMs ?? 15 * 60_000,
        );
      });
    },
  }).submit;
