import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rename, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Result, ResultAsync } from "neverthrow";
import type { ExecutionArtifactRecord, ExecutionInputAssetRecord } from "@repo/db-schema";
import type { ExecutionPrincipal } from "@repo/schemas";
import { createExecutionArtifactStore } from "./createExecutionArtifactStore";
import type { ArtifactStoreError } from "./errors";
import type { ExecutionArtifactContext, ExecutionArtifactPersistence } from "./types";

const principal: ExecutionPrincipal = {
  subjectId: "owner",
  workspaceId: "workspace",
  scopes: ["artifacts:read", "artifacts:import"],
};
const bytes = (text: string) => new TextEncoder().encode(text);
const resultFailed = async <T>(pending: ResultAsync<T, ArtifactStoreError>) => {
  const result = await pending;

  return result.isErr();
};
const unwrap = <T>(result: Result<T, ArtifactStoreError>): T => {
  if (result.isErr()) throw result.error;

  return result.value;
};
const makeFixture = async (limits: { maxFileBytes?: number; maxConcurrentReads?: number } = {}) => {
  const directory = await mkdtemp(join(tmpdir(), "ordine-r8-test-"));
  const inputs = new Map<string, ExecutionInputAssetRecord>();
  const artifacts = new Map<string, ExecutionArtifactRecord>();
  const imports = new Map<string, ExecutionInputAssetRecord>();
  const controller = new AbortController();
  const context: ExecutionArtifactContext = {
    lease: {
      jobId: randomUUID(),
      executorId: "executor",
      generation: 1,
      subjectId: principal.subjectId,
      workspaceId: principal.workspaceId,
    },
    nodeId: "producer",
    attemptId: randomUUID(),
    signal: controller.signal,
  };
  const state = {
    leaseChecks: 0,
    leaseValid: true,
    registrationFails: false,
    abortAtRegistrationCheck: false,
    loseLeaseAtRegistrationCheck: false,
  };
  const sameOwner = (identity: Pick<ExecutionPrincipal, "subjectId" | "workspaceId">) =>
    identity.subjectId === principal.subjectId && identity.workspaceId === principal.workspaceId;
  const persistence: ExecutionArtifactPersistence = {
    replayInputImport: async (identity, requestId, inputHash) => {
      const row = imports.get(`${identity.subjectId}:${identity.workspaceId}:${requestId}`);
      if (row && row.inputHash !== inputHash)
        throw Object.assign(new Error("conflict"), { name: "ExecutionIdempotencyConflictError" });

      return row ?? null;
    },
    createInputAsset: async (identity, data) => {
      if (state.registrationFails) throw new Error("private database connection error");
      const key = `${identity.subjectId}:${identity.workspaceId}:${data.importRequestId}`;
      const prior = imports.get(key);
      if (prior) return prior;
      const row: ExecutionInputAssetRecord = {
        ...data,
        subjectId: identity.subjectId,
        workspaceId: identity.workspaceId,
      };
      inputs.set(row.artifactId, row);
      imports.set(key, row);

      return row;
    },
    getInputAsset: async (identity, id) => (sameOwner(identity) ? (inputs.get(id) ?? null) : null),
    getProducedArtifact: async (identity, id) =>
      sameOwner(identity) ? (artifacts.get(id) ?? null) : null,
    registerArtifact: async (_lease, data) => {
      if (state.registrationFails) throw new Error("private registration error");
      const metadata = data.metadata;
      const row: ExecutionArtifactRecord = {
        artifactId: metadata.artifactId,
        jobId: metadata.jobId,
        nodeId: metadata.nodeId,
        portId: metadata.portId,
        attemptId: metadata.attemptId,
        state: metadata.state,
        ...data,
      };
      artifacts.set(row.artifactId, row);

      return row;
    },
    assertLease: async () => {
      state.leaseChecks += 1;
      if (state.abortAtRegistrationCheck && state.leaseChecks === 2) controller.abort();
      if (!state.leaseValid || (state.loseLeaseAtRegistrationCheck && state.leaseChecks === 2))
        throw new Error("lease lost");
    },
    assertJobLease: async () => {
      if (!state.leaseValid) throw new Error("job lease lost");
    },
  };
  const store = unwrap(
    await createExecutionArtifactStore({ rootDirectory: directory, persistence, limits }),
  );
  const publish = (id: string) => {
    const row = artifacts.get(id)!;
    artifacts.set(id, {
      ...row,
      state: "published",
      metadata: { ...row.metadata, state: "published" },
    });
  };

  return { directory, inputs, artifacts, controller, context, state, persistence, store, publish };
};

describe("execution artifact file store (fake metadata persistence)", () => {
  it("verifies job-level metadata without requiring an active or fabricated attempt", async () => {
    const fixture = await makeFixture();
    const input = unwrap(
      await fixture.store.importInput(principal, {
        importRequestId: randomUUID(),
        name: "input.txt",
        mimeType: "text/plain",
        bytes: bytes("input"),
      }),
    );
    const output = unwrap(
      await fixture.store.writeProduced(
        { ...fixture.context, portId: "result" },
        { name: "output.txt", mimeType: "text/plain", bytes: bytes("output") },
      ),
    );
    fixture.persistence.assertLease = async () => {
      throw new Error("No active attempt");
    };
    const jobContext = { lease: fixture.context.lease, signal: fixture.context.signal };
    expect(unwrap(await fixture.store.metadataForJob(jobContext, input.artifactId)).sha256).toBe(
      input.sha256,
    );
    expect(unwrap(await fixture.store.metadataForJob(jobContext, output.artifactId)).sha256).toBe(
      output.sha256,
    );
    fixture.state.leaseValid = false;
    expect(await resultFailed(fixture.store.metadataForJob(jobContext, input.artifactId))).toBe(
      true,
    );
  });
  it("imports immutable input before a Job, replays idempotently and returns verified chunks", async () => {
    const fixture = await makeFixture();
    const request = {
      importRequestId: randomUUID(),
      name: "输入.json",
      mimeType: "application/json",
      bytes: bytes('{"answer":42}'),
    };
    const first = unwrap(await fixture.store.importInput(principal, request));
    const replay = unwrap(await fixture.store.importInput(principal, request));
    expect(replay.artifactId).toBe(first.artifactId);
    expect(fixture.inputs.size).toBe(1);
    expect(first.sizeBytes).toBe(request.bytes.byteLength);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toHaveProperty("jobId");
    expect(first).not.toHaveProperty("storageKey");
    const snapshot = unwrap(await fixture.store.getInputSnapshot(principal, first.artifactId));
    expect(snapshot.source).toEqual({ kind: "input_asset" });
    const chunk = unwrap(
      await fixture.store.readArtifact(principal, first.artifactId, { offset: 2, length: 4 }),
    );
    expect(chunk.bytes).toEqual(request.bytes.slice(2, 6));
    expect(chunk.totalSizeBytes).toBe(first.sizeBytes);
    const changed = await fixture.store.importInput(principal, { ...request, bytes: bytes("{}") });
    expect(changed.isErr()).toBe(true);
  });

  it("keeps two same-named files and different attempts separate and supports published source reuse", async () => {
    const fixture = await makeFixture();
    const first = unwrap(
      await fixture.store.writeProduced(
        { ...fixture.context, portId: "result" },
        { name: "result.txt", mimeType: "text/plain", bytes: bytes("first") },
      ),
    );
    const second = unwrap(
      await fixture.store.writeProduced(
        { ...fixture.context, attemptId: randomUUID(), portId: "result" },
        { name: "result.txt", mimeType: "text/plain", bytes: bytes("second") },
      ),
    );
    expect(first.artifactId).not.toBe(second.artifactId);
    expect(fixture.artifacts.get(first.artifactId)?.storageKey).not.toBe(
      fixture.artifacts.get(second.artifactId)?.storageKey,
    );
    expect(await resultFailed(fixture.store.readArtifact(principal, first.artifactId))).toBe(true);
    expect(
      unwrap(await fixture.store.readForExecution(fixture.context, first.artifactId)).bytes,
    ).toEqual(bytes("first"));
    fixture.publish(first.artifactId);
    const otherJob = {
      ...fixture.context,
      lease: { ...fixture.context.lease, jobId: randomUUID() },
    };
    expect(unwrap(await fixture.store.readForExecution(otherJob, first.artifactId)).bytes).toEqual(
      bytes("first"),
    );
    expect(unwrap(await fixture.store.metadataForExecution(otherJob, first.artifactId))).toEqual({
      artifactId: first.artifactId,
      mimeType: first.mimeType,
      sha256: first.sha256,
      sizeBytes: first.sizeBytes,
    });
  });

  it("rejects wrong identity, absent scopes and rejected/unpublished cross-Job artifacts", async () => {
    const fixture = await makeFixture();
    const input = unwrap(
      await fixture.store.importInput(principal, {
        importRequestId: randomUUID(),
        name: "a.bin",
        mimeType: "application/octet-stream",
        bytes: new Uint8Array([0, 255]),
      }),
    );
    expect(
      await resultFailed(
        fixture.store.readArtifact({ ...principal, subjectId: "other" }, input.artifactId),
      ),
    ).toBe(true);
    expect(
      await resultFailed(
        fixture.store.readArtifact({ ...principal, scopes: [] }, input.artifactId),
      ),
    ).toBe(true);
    const output = unwrap(
      await fixture.store.writeProduced(
        { ...fixture.context, portId: "result" },
        { name: "a.bin", mimeType: "application/x-unknown", bytes: new Uint8Array([255]) },
      ),
    );
    const otherJob = {
      ...fixture.context,
      lease: { ...fixture.context.lease, jobId: randomUUID() },
    };
    expect(await resultFailed(fixture.store.readForExecution(otherJob, output.artifactId))).toBe(
      true,
    );
    const row = fixture.artifacts.get(output.artifactId)!;
    fixture.artifacts.set(output.artifactId, {
      ...row,
      state: "rejected",
      metadata: { ...row.metadata, state: "rejected" },
    });
    expect(
      await resultFailed(fixture.store.readForExecution(fixture.context, output.artifactId)),
    ).toBe(true);
  });

  it("imports only relative regular files from the current attempt workspace", async () => {
    const fixture = await makeFixture();
    const workspace = unwrap(await fixture.store.createAttemptWorkspace(fixture.context));
    await writeFile(join(workspace, "实际结果.json"), '{"ok":true}', "utf8");
    const output = unwrap(
      await fixture.store.registerProducedFile(
        { ...fixture.context, portId: "result" },
        { relativePath: "实际结果.json", name: "report.json", mimeType: "application/json" },
      ),
    );
    expect(
      unwrap(await fixture.store.readForExecution(fixture.context, output.artifactId)).bytes,
    ).toEqual(bytes('{"ok":true}'));
    for (const relativePath of [
      "../secret",
      "x/../../secret",
      "C:\\secret",
      "/secret",
      "\\\\server\\file",
      "实际结果.json:stream",
      ".",
      "x\\..\\secret",
    ]) {
      expect(
        await resultFailed(
          fixture.store.registerProducedFile(
            { ...fixture.context, portId: "result" },
            { relativePath, name: "report.json", mimeType: "application/json" },
          ),
        ),
      ).toBe(true);
    }
    expect(await readFile(join(workspace, "实际结果.json"), "utf8")).toBe('{"ok":true}');
  });

  it("rejects junctions in attempt source and persisted storage paths", async () => {
    const fixture = await makeFixture();
    const external = await mkdtemp(join(tmpdir(), "ordine-r8-outside-"));
    await writeFile(join(external, "outside.txt"), "outside", "utf8");
    const workspace = unwrap(await fixture.store.createAttemptWorkspace(fixture.context));
    await symlink(
      external,
      join(workspace, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(
      await resultFailed(
        fixture.store.registerProducedFile(
          { ...fixture.context, portId: "result" },
          { relativePath: "linked/outside.txt", name: "outside.txt", mimeType: "text/plain" },
        ),
      ),
    ).toBe(true);
    const input = unwrap(
      await fixture.store.importInput(principal, {
        importRequestId: randomUUID(),
        name: "safe.txt",
        mimeType: "text/plain",
        bytes: bytes("safe"),
      }),
    );
    const row = fixture.inputs.get(input.artifactId)!;
    fixture.inputs.set(input.artifactId, { ...row, storageKey: "../outside.txt" });
    expect(await resultFailed(fixture.store.readArtifact(principal, input.artifactId))).toBe(true);
    fixture.inputs.set(input.artifactId, row);
    await writeFile(join(external, input.artifactId), "safe", "utf8");
    await rename(join(fixture.directory, "inputs"), join(fixture.directory, "inputs-retained"));
    await symlink(
      external,
      join(fixture.directory, "inputs"),
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(await resultFailed(fixture.store.readArtifact(principal, input.artifactId))).toBe(true);
  });

  it("detects hash/size tampering and missing physical files instead of changing metadata", async () => {
    const fixture = await makeFixture();
    const input = unwrap(
      await fixture.store.importInput(principal, {
        importRequestId: randomUUID(),
        name: "a.txt",
        mimeType: "text/plain",
        bytes: bytes("first"),
      }),
    );
    const file = join(fixture.directory, fixture.inputs.get(input.artifactId)!.storageKey);
    await writeFile(file, "other", "utf8");
    expect(
      await resultFailed(
        fixture.store.readArtifact(principal, input.artifactId, { offset: 0, length: 1 }),
      ),
    ).toBe(true);
    await writeFile(file, "first", "utf8");
    const restored = unwrap(await fixture.store.readArtifact(principal, input.artifactId));
    expect(restored.bytes).toEqual(bytes("first"));
    await writeFile(file, "size changed", "utf8");
    expect(await resultFailed(fixture.store.readArtifact(principal, input.artifactId))).toBe(true);
    await unlink(file);
    expect(await resultFailed(fixture.store.readArtifact(principal, input.artifactId))).toBe(true);
  });

  it("rejects unsafe display names, MIME control characters and invalid UTF-8/JSON", async () => {
    const fixture = await makeFixture({ maxFileBytes: 20 });
    const request = {
      importRequestId: randomUUID(),
      name: "a.txt",
      mimeType: "text/plain",
      bytes: bytes("a"),
    };
    for (const invalid of [
      { name: "../a" },
      { name: "a:stream" },
      { name: "CON" },
      { mimeType: "text/plain\r\nX-Test: injected" },
      { bytes: new Uint8Array([255]) },
      { mimeType: "application/json", bytes: bytes("not-json") },
      { bytes: bytes("x".repeat(21)) },
    ]) {
      expect(
        await resultFailed(fixture.store.importInput(principal, { ...request, ...invalid })),
      ).toBe(true);
    }
    expect(fixture.inputs.size).toBe(0);
  });

  it("does not register after cancellation or lease loss and retains identifiable staging on DB failure", async () => {
    const fixture = await makeFixture();
    const payload = { name: "a.txt", mimeType: "text/plain", bytes: bytes("data") };
    fixture.state.abortAtRegistrationCheck = true;
    expect(
      await resultFailed(
        fixture.store.writeProduced({ ...fixture.context, portId: "result" }, payload),
      ),
    ).toBe(true);
    expect(fixture.artifacts.size).toBe(0);
    const lost = await makeFixture();
    lost.state.loseLeaseAtRegistrationCheck = true;
    expect(
      await resultFailed(lost.store.writeProduced({ ...lost.context, portId: "result" }, payload)),
    ).toBe(true);
    expect(lost.artifacts.size).toBe(0);
    const failing = await makeFixture();
    failing.state.registrationFails = true;
    const failed = await failing.store.writeProduced(
      { ...failing.context, portId: "result" },
      payload,
    );
    expect(failed.isErr()).toBe(true);
    if (failed.isErr()) {
      expect(failed.error.stagedArtifactId).toBeTruthy();
      expect(failed.error.message).not.toContain(failing.directory);
    }
    const staging = await readdir(join(failing.directory, "staging"));
    expect(staging.length).toBeGreaterThan(0);
    expect(failing.artifacts.size).toBe(0);
  });

  it("converges concurrent imports through persistence and marks the redundant staged candidate", async () => {
    const fixture = await makeFixture();
    const input = {
      importRequestId: randomUUID(),
      name: "same.txt",
      mimeType: "text/plain",
      bytes: bytes("same"),
    };
    const results = await Promise.all([
      fixture.store.importInput(principal, input),
      fixture.store.importInput(principal, input),
    ]);
    expect(unwrap(results[0]!).artifactId).toBe(unwrap(results[1]!).artifactId);
    expect(fixture.inputs.size).toBe(1);
    const staging = await readdir(join(fixture.directory, "staging"));
    expect(staging.some((name) => name.endsWith(".orphaned"))).toBe(true);
  });

  it("bounds concurrent full reads without an unbounded waiting queue", async () => {
    const fixture = await makeFixture({ maxConcurrentReads: 1 });
    const input = unwrap(
      await fixture.store.importInput(principal, {
        importRequestId: randomUUID(),
        name: "a.txt",
        mimeType: "text/plain",
        bytes: bytes("data"),
      }),
    );
    const results = await Promise.all([
      fixture.store.readArtifact(principal, input.artifactId),
      fixture.store.readArtifact(principal, input.artifactId),
    ]);
    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    const failed = results.find((result) => result.isErr());
    expect(failed?.isErr() && failed.error.code).toBe("ARTIFACT_READ_LIMIT");
    const next = unwrap(await fixture.store.readArtifact(principal, input.artifactId));
    expect(next.bytes).toEqual(bytes("data"));
  });
});
