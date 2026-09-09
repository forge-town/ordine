import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OperationRevisionSchema,
  RuntimeNodeSchema,
  EXECUTION_TIMEOUT_DEFAULTS,
} from "@repo/schemas";
import type { ExecutionArtifactRecord, ExecutionInputAssetRecord } from "@repo/db-schema";
import { createExecutionArtifactStore } from "../executionArtifacts";
import type { ExecutionActorContext } from "../executionActors";
import { requirePromptResult } from "./errors";
import { inspectCodexCredentialRef } from "./codexHome";

export const promptFixture = async (executable: string, model = "gpt-test") => {
  const directory = await mkdtemp(join(tmpdir(), "ordine-prompt-test-"));
  const inputs = new Map<string, ExecutionInputAssetRecord>();
  const artifacts = new Map<string, ExecutionArtifactRecord>();
  const controller = new AbortController();
  const jobId = randomUUID();
  const attemptId = randomUUID();
  const store = requirePromptResult(
    await createExecutionArtifactStore({
      rootDirectory: directory,
      persistence: {
        replayInputImport: async () => null,
        createInputAsset: async (identity, data) => {
          const row = { ...identity, ...data };
          inputs.set(row.artifactId, row);

          return row;
        },
        getInputAsset: async (_identity, id) => inputs.get(id) ?? null,
        getProducedArtifact: async (_identity, id) => artifacts.get(id) ?? null,
        registerArtifact: async (_lease, data) => {
          const row = { ...data.metadata, ...data };
          artifacts.set(row.artifactId, row);

          return row;
        },
        assertLease: async () => {
          if (controller.signal.aborted) throw new Error("cancelled");
        },
        assertJobLease: async () => {
          if (controller.signal.aborted) throw new Error("cancelled");
        },
      },
    }),
  );
  const context: ExecutionActorContext = {
    jobId,
    attemptId,
    node: RuntimeNodeSchema.parse({
      id: "prompt",
      operation: { operationId: "prompt", revision: 1 },
    }),
    operation: OperationRevisionSchema.parse({
      apiVersion: 2,
      id: "prompt",
      revision: 1,
      name: "prompt",
      inputPorts: [],
      outputPorts: [
        {
          id: "out",
          valueType: "json",
          cardinality: "one",
          jsonSchema: {
            type: "object",
            properties: { proof: { type: "string" } },
            required: ["proof"],
            additionalProperties: false,
          },
        },
      ],
      executor: {
        kind: "agent",
        instruction: 'Return exactly {"proof":"v2-live-ok"}. Do not call tools.',
      },
    }),
    resolved: {
      executorKind: "agent",
      agent: "codex",
      runtimeConfigId: "codex",
      executablePath: executable,
      executableSha256: createHash("sha256")
        .update(await readFile(executable))
        .digest("hex"),
      model,
      reasoningEffort: "low",
      speed: "standard",
      timeouts: { ...EXECUTION_TIMEOUT_DEFAULTS, activeRunTimeoutMs: 180_000 },
      origins: {},
    },
    inputs: {},
    iteration: 1,
    attemptNumber: 1,
    sharedContext: "shared 中文",
    credentialRefs: [await inspectCodexCredentialRef()],
    signal: controller.signal,
    artifactContext: {
      lease: {
        subjectId: "owner",
        workspaceId: "workspace",
        jobId,
        executorId: "executor",
        generation: 1,
      },
      nodeId: "prompt",
      attemptId,
      signal: controller.signal,
    },
  };
  const workspace = requirePromptResult(
    await store.createAttemptWorkspace(context.artifactContext),
  );

  return { directory, workspace, context, controller, store };
};
