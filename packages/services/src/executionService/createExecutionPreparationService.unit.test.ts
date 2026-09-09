import { randomUUID } from "node:crypto";
import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { RunRequestReceiptSchema, OperationRevisionSchema } from "@repo/schemas";
import {
  hashExecutionJson,
  verifyPreparedRun,
  ExecutionRevisionConflictError,
  type ExecutionRepository,
} from "@repo/models";
import { executionFixture } from "../../../models/src/repositories/executionRepository/executionFixtures";
import { ArtifactStoreError } from "../executionArtifacts/errors";
import { createExecutionPreparationService } from "./createExecutionPreparationService";

const setup = (script = false) => {
  const f = executionFixture();
  f.principal.scopes.push("artifacts:read");
  if (script)
    f.operation.executor = {
      kind: "script",
      language: "javascript",
      source: "console.log('ok')",
      outputMode: "text",
    };
  const accepted = RunRequestReceiptSchema.parse({
    apiVersion: 2,
    state: "accepted",
    requestId: f.input.requestId,
    preparedRunId: randomUUID(),
    jobId: randomUUID(),
    acceptedAt: new Date().toISOString(),
  });
  const repository = {
    getOperationRevision: vi.fn(async () => f.operation),
    saveOperation: vi.fn(async () => f.operation),
    savePipeline: vi.fn(async () => f.pipeline),
    getPipeline: vi.fn(async () => f.pipeline),
    replayRunRequest: vi.fn(async (): Promise<typeof accepted | null> => null),
    getWorkspaceSettings: vi.fn(async () => null),
    listRuntimeConfigs: vi.fn<ExecutionRepository["listRuntimeConfigs"]>(async () => []),
    submitRun: vi.fn<ExecutionRepository["submitRun"]>(async () => accepted),
  };
  const getInputSnapshot = vi.fn(() =>
    okAsync({
      artifactId: "asset-1",
      name: "input.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      sha256: "a".repeat(64),
      source: { kind: "input_asset" as const },
    }),
  );
  const fingerprint = vi.fn(() =>
    okAsync({ executablePath: "C:/native/node.exe", executableSha256: "b".repeat(64) }),
  );
  const credentialRef = vi.fn(async () => `codex-${"c".repeat(64)}`);
  const service = createExecutionPreparationService({
    repository,
    artifactStore: { getInputSnapshot },
    fingerprintExecutable: fingerprint,
    inspectCodexCredentialRef: credentialRef,
    scriptExecutables: { javascript: "C:/configured/node.exe" },
  });

  return { ...f, repository, service, accepted, getInputSnapshot, fingerprint, credentialRef };
};

describe("execution preparation boundary", () => {
  it("replays the original receipt before consulting changed definitions or defaults", async () => {
    const f = setup();
    f.repository.replayRunRequest.mockResolvedValue(f.accepted);
    const result = await f.service.submit(f.principal, f.input);
    expect(result._unsafeUnwrap()).toEqual(f.accepted);
    expect(f.repository.getPipeline).not.toHaveBeenCalled();
    expect(f.repository.getWorkspaceSettings).not.toHaveBeenCalled();
    expect(f.repository.submitRun).not.toHaveBeenCalled();
  });

  it("prepares a pure builtin without querying any Agent runtime", async () => {
    const f = setup();
    expect((await f.service.submit(f.principal, f.input)).isOk()).toBe(true);
    expect(f.repository.listRuntimeConfigs).not.toHaveBeenCalled();
    expect(f.fingerprint).not.toHaveBeenCalled();
    expect(f.credentialRef).not.toHaveBeenCalled();
    const prepared = f.repository.submitRun.mock.calls[0]![3];
    expect(verifyPreparedRun(prepared)).toEqual(prepared);
    expect(prepared.risk).toEqual({ requiresApproval: false, reasons: [] });
    expect(prepared.operations[0]?.revision).toBe(1);
    expect(f.repository.submitRun.mock.calls[0]![2]).toBe(hashExecutionJson(f.input));
  });

  it("freezes the selected Codex credential reference into the approved content hash", async () => {
    const f = setup();
    f.operation.executor = { kind: "agent", instruction: "Summarize input", allowedTools: [] };
    f.operation.executionDefaults = { runtimeConfigId: "codex", model: "test-model" };
    f.repository.listRuntimeConfigs.mockResolvedValue([
      {
        workspaceId: f.principal.workspaceId,
        id: "codex",
        revision: 1,
        config: {
          id: "codex",
          name: "Codex",
          type: "codex",
          connection: {
            mode: "local",
            path: "C:/configured/codex.exe",
            models: [{ id: "test-model", displayName: "Test" }],
          },
        },
      },
    ]);
    expect((await f.service.submit(f.principal, f.input)).isOk()).toBe(true);
    expect(f.credentialRef).toHaveBeenCalledTimes(1);
    const prepared = f.repository.submitRun.mock.calls[0]![3];
    expect(prepared.credentialRefs).toEqual([`codex-${"c".repeat(64)}`]);
    expect(verifyPreparedRun(prepared)).toEqual(prepared);
  });

  it("freezes the executable hash, exact input, and zero first-output timeout before approval", async () => {
    const f = setup(true);
    f.input.executionOverrides.firstOutputTimeoutMs = 0;
    await f.service.submit(f.principal, f.input);
    const prepared = f.repository.submitRun.mock.calls[0]![3];
    expect(prepared.risk.requiresApproval).toBe(true);
    expect(prepared.resolvedNodes.identity).toMatchObject({
      executablePath: "C:/native/node.exe",
      executableSha256: "b".repeat(64),
      timeouts: { firstOutputTimeoutMs: 0 },
    });
    expect(prepared.inputs).toEqual(f.input.inputs);
    expect(f.fingerprint).toHaveBeenCalledWith("C:/configured/node.exe");
    expect(verifyPreparedRun(prepared)).toEqual(prepared);
  });

  it("rejects missing required inputs and mismatched port types before persisting a request", async () => {
    const f = setup();
    const empty = await f.service.submit(f.principal, { ...f.input, inputs: {} });
    expect(empty.isErr()).toBe(true);
    const wrong = await f.service.submit(f.principal, {
      ...f.input,
      inputs: { value: [{ kind: "json", value: 1 }] },
    });
    expect(wrong.isErr()).toBe(true);
    expect(f.repository.submitRun).not.toHaveBeenCalled();
  });

  it("rejects stale revisions and missing scopes before creating a Job", async () => {
    const f = setup();
    const stale = await f.service.submit(f.principal, { ...f.input, expectedRevision: 2 });
    expect(stale._unsafeUnwrapErr().code).toBe("REVISION_CONFLICT");
    const denied = await f.service.submit({ ...f.principal, scopes: [] }, f.input);
    expect(denied._unsafeUnwrapErr().code).toBe("FORBIDDEN");
    expect(f.repository.submitRun).not.toHaveBeenCalled();
  });

  it("requires valid pinned port wiring when saving a Pipeline", async () => {
    const f = setup();
    const { id, revision: _revision, apiVersion, ...definition } = f.pipeline;
    definition.graph.edges[0]!.target.portId = "missing";
    const result = await f.service.savePipeline(f.principal, {
      apiVersion,
      pipelineId: id,
      expectedRevision: 0,
      definition,
    });
    expect(result.isErr()).toBe(true);
    expect(f.repository.savePipeline).not.toHaveBeenCalled();
  });

  it("preserves the repository CAS failure when the Pipeline changes during preparation", async () => {
    const f = setup(true);
    f.repository.submitRun.mockRejectedValue(new ExecutionRevisionConflictError("Pipeline"));
    const result = await f.service.submit(f.principal, f.input);
    expect(result._unsafeUnwrapErr().code).toBe("REVISION_CONFLICT");
    expect(f.repository.submitRun).toHaveBeenCalledTimes(1);
  });

  it("refuses unimplemented capabilities instead of silently discarding them", async () => {
    const f = setup();
    const operation = OperationRevisionSchema.parse({
      ...f.operation,
      capabilityRefs: ["secret-tool"],
    });
    const result = await f.service.saveOperation(f.principal, {
      apiVersion: 2,
      expectedRevision: 0,
      operation,
    });
    expect(result._unsafeUnwrapErr().code).toBe("CAPABILITY_UNSUPPORTED");
    expect(f.repository.saveOperation).not.toHaveBeenCalled();
  });

  it("binds artifact bytes to a snapshot before accepting an input", async () => {
    const f = setup();
    f.operation.inputPorts[0]!.valueType = "artifact";
    f.operation.outputPorts[0]!.valueType = "artifact";
    f.pipeline.graph.inputs[0]!.valueType = "artifact";
    f.pipeline.graph.outputs[0]!.port.valueType = "artifact";
    f.input.inputs = { value: [{ kind: "artifact", artifactId: "asset-1" }] };
    const result = await f.service.submit(f.principal, f.input);
    expect(result.isOk()).toBe(true);
    expect(f.repository.submitRun.mock.calls[0]![3].inputArtifacts).toEqual([
      expect.objectContaining({ artifactId: "asset-1", sha256: "a".repeat(64) }),
    ]);
    const failing = createExecutionPreparationService({
      repository: f.repository,
      artifactStore: {
        getInputSnapshot: () =>
          errAsync(new ArtifactStoreError("ARTIFACT_INTEGRITY_FAILED", "Input content changed")),
      },
      scriptExecutables: {},
    });
    f.repository.submitRun.mockClear();
    const changed = await failing.submit(f.principal, { ...f.input, requestId: randomUUID() });
    expect(changed._unsafeUnwrapErr().code).toBe("ARTIFACT_INTEGRITY_FAILED");
    expect(f.repository.submitRun).not.toHaveBeenCalled();
  });
});
