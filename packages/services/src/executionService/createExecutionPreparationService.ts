import { randomUUID } from "node:crypto";
import { type Result } from "neverthrow";
import { hashExecutionJson, hashPreparedRun, type ExecutionRepository } from "@repo/models";
import {
  compileDefinitionGraph,
  validateOperationDefinition,
  validatePortValues,
  validatePreparedGraph,
} from "@repo/pipeline-engine";
import {
  PreparedRunSchema,
  RunRequestInputSchema,
  SavePipelineDefinitionSchema,
  SaveOperationRevisionSchema,
  type ExecutionError,
  type ExecutionPrincipal,
  type OperationRevision,
  type PipelineDefinition,
  type PreparedRun,
} from "@repo/schemas";
import type { createExecutionArtifactStore } from "../executionArtifacts/createExecutionArtifactStore";
import { resolveNodeExecution } from "./resolveNodeExecution";
import { fingerprintExecutable } from "./fingerprintExecutable";
import { inspectCodexCredentialRef } from "../executionPrompt/codexHome";
import {
  ExecutionServiceFailure,
  executionFailure,
  executionServiceResult,
  requireExecutionScope,
} from "./serviceResult";

type ArtifactStore = ReturnType<
  Awaited<ReturnType<typeof createExecutionArtifactStore>>["_unsafeUnwrap"]
>;
type Dependencies = {
  repository: Pick<
    ExecutionRepository,
    | "getOperationRevision"
    | "saveOperation"
    | "savePipeline"
    | "getPipeline"
    | "replayRunRequest"
    | "getWorkspaceSettings"
    | "listRuntimeConfigs"
    | "submitRun"
  >;
  artifactStore: Pick<ArtifactStore, "getInputSnapshot">;
  scriptExecutables: Partial<Record<"javascript" | "python" | "bash", string>>;
  fingerprintExecutable?: typeof fingerprintExecutable;
  approvalTtlMs?: number;
  isAccepting?: () => boolean;
  inspectCodexCredentialRef?: typeof inspectCodexCredentialRef;
};

const unwrap = <T>(result: Result<T, ExecutionError>): T => {
  if (result.isErr()) throw new ExecutionServiceFailure(result.error);

  return result.value;
};

const supportedDefinition = (operation: OperationRevision) => {
  unwrap(validateOperationDefinition(operation));
  if (operation.capabilityRefs.length > 0)
    executionFailure(
      "CAPABILITY_UNSUPPORTED",
      "This execution adapter does not implement capability references",
      "capabilityRefs",
    );
  const executor = operation.executor;
  if (executor.kind === "agent") {
    if (executor.skillId || executor.allowedTools.length > 0)
      executionFailure(
        "AGENT_TOOLS_UNSUPPORTED",
        "Prompt operations currently require an explicit instruction without external tools or skills",
        "executor",
      );
    if (
      operation.outputPorts.length !== 1 ||
      operation.outputPorts[0]?.cardinality !== "one" ||
      !["text", "json"].includes(operation.outputPorts[0]?.valueType ?? "")
    )
      executionFailure(
        "AGENT_OUTPUT_UNSUPPORTED",
        "Prompt operations require exactly one text or JSON output port",
        "outputPorts",
      );
  }
  if (
    executor.kind === "script" &&
    executor.outputMode !== "manifest" &&
    (operation.outputPorts.length !== 1 ||
      operation.outputPorts[0]?.cardinality !== "one" ||
      operation.outputPorts[0]?.valueType !== executor.outputMode)
  )
    executionFailure(
      "SCRIPT_OUTPUT_INVALID",
      "Text and JSON scripts require exactly one matching output port",
      "outputPorts",
    );
};

export const createExecutionPreparationService = (deps: Dependencies) => {
  const repository = deps.repository;
  const fingerprint = deps.fingerprintExecutable ?? fingerprintExecutable;
  const pinnedOperations = async (workspaceId: string, graph: PipelineDefinition["graph"]) => {
    const operations = new Map<string, OperationRevision>();
    for (const node of graph.nodes) {
      const key = `${node.operation.operationId}:${node.operation.revision}`;
      if (operations.has(key)) continue;
      const operation = await repository.getOperationRevision(
        workspaceId,
        node.operation.operationId,
        node.operation.revision,
      );
      if (!operation)
        executionFailure(
          "NOT_FOUND",
          "A pinned Operation revision is unavailable",
          `nodes.${node.id}.operation`,
        );
      supportedDefinition(operation);
      operations.set(key, operation);
    }
    const revisions = [...operations.values()];
    unwrap(compileDefinitionGraph(graph, revisions));

    return revisions;
  };

  return {
    saveOperation(principalInput: ExecutionPrincipal, value: unknown) {
      return executionServiceResult(async () => {
        const principal = requireExecutionScope(principalInput, "definitions:write");
        const input = SaveOperationRevisionSchema.parse(value);
        supportedDefinition(input.operation);

        return repository.saveOperation(
          principal.workspaceId,
          input.operation,
          input.expectedRevision,
        );
      });
    },
    savePipeline(principalInput: ExecutionPrincipal, value: unknown) {
      return executionServiceResult(async () => {
        const principal = requireExecutionScope(principalInput, "definitions:write");
        const input = SavePipelineDefinitionSchema.parse(value);
        await pinnedOperations(principal.workspaceId, input.definition.graph);

        return repository.savePipeline(principal.workspaceId, input);
      });
    },
    submit(principalInput: ExecutionPrincipal, value: unknown) {
      return executionServiceResult(async () => {
        const principal = requireExecutionScope(principalInput, "execution:submit");
        const input = RunRequestInputSchema.parse(value);
        const inputHash = hashExecutionJson(input);
        const replay = await repository.replayRunRequest(principal, input, inputHash);
        if (replay) return replay;
        if (deps.isAccepting && !deps.isAccepting())
          executionFailure(
            "EXECUTION_DRAINING",
            "This application is shutting down; retry after it restarts",
          );
        const pipeline = await repository.getPipeline(principal.workspaceId, input.pipelineId);
        if (!pipeline) executionFailure("NOT_FOUND", "Pipeline was not found", "pipelineId");
        if (pipeline.revision !== input.expectedRevision)
          executionFailure(
            "REVISION_CONFLICT",
            "Pipeline changed; save and submit its current revision",
            "expectedRevision",
          );
        const operations = await pinnedOperations(principal.workspaceId, pipeline.graph);
        const settings = await repository.getWorkspaceSettings(principal.workspaceId);
        const needsAgent = operations.some((operation) => operation.executor.kind === "agent");
        const runtimes = needsAgent
          ? (await repository.listRuntimeConfigs(principal.workspaceId)).map((row) => row.config)
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
              ? deps.scriptExecutables[operation.executor.language]
              : resolved.executablePath;
          if (operation.executor.kind !== "builtin") {
            if (!executable)
              executionFailure(
                "EXECUTABLE_REQUIRED",
                "The selected interpreter is not configured",
                `nodes.${node.id}.executablePath`,
              );
            const cached = fingerprints.get(executable) ?? (await fingerprint(executable));
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
          const snapshot = await deps.artifactStore.getInputSnapshot(principal, artifactId);
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
            ? [await (deps.inspectCodexCredentialRef ?? inspectCodexCredentialRef)()]
            : [],
          risk: { requiresApproval: reasons.length > 0, reasons },
          contentHash: "0".repeat(64),
        });
        prepared.contentHash = hashPreparedRun(prepared);
        unwrap(validatePreparedGraph(prepared));

        if (deps.isAccepting && !deps.isAccepting())
          executionFailure(
            "EXECUTION_DRAINING",
            "This application is shutting down; retry after it restarts",
          );

        return repository.submitRun(
          principal,
          input,
          inputHash,
          prepared,
          deps.approvalTtlMs ?? 15 * 60_000,
        );
      });
    },
  };
};
export type ExecutionPreparationService = ReturnType<typeof createExecutionPreparationService>;
