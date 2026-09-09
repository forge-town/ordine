import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { ExecutionArtifact, ExecutionPrincipal } from "@repo/schemas";
import type { DbConnection } from "../../types";
import type { ExecutionLease } from "../../executionTypes";
import { executionFixture } from "../executionRepository/executionFixtures";
import { createExecutionRepository } from "../executionRepository";
import { hashExecutionJson, hashPreparedRun } from "../executionRepository/executionHash";
import { createExecutionJobRepository } from "./executionJobRepository";

const databaseUrl = process.env.ORDINE_EXECUTION_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("An explicitly isolated R7 database is required");
const target = new URL(databaseUrl);
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "36435" ||
  target.pathname !== "/ordine_pipeline_v2_r5"
)
  throw new Error("Refusing unapproved lifecycle database");
const namespace = `execution_r7_${randomUUID().replaceAll("-", "")}`;
const client = postgres(databaseUrl, {
  max: 24,
  connection: { search_path: namespace },
  onnotice: () => {},
});
const db = drizzle(client) as DbConnection;
const requests = createExecutionRepository(db);
const jobs = createExecutionJobRepository(db);
const migrationPath = join(
  import.meta.dirname,
  "../../../../..",
  "apps/create/migrations-v2/0001_execution.sql",
);

const prepareJob = async (
  options: { checkpoint?: boolean; artifact?: boolean; bestEffort?: boolean } = {},
) => {
  const f = executionFixture();
  f.principal.scopes.push("execution:control");
  f.pipeline.graph.nodes[0]!.checkpoint = options.checkpoint ?? false;
  f.pipeline.graph.nodes[0]!.retry.maxAttempts = 2;
  f.pipeline.graph.nodes[0]!.failurePolicy = options.bestEffort ? "best_effort" : "required";
  if (options.artifact) {
    f.operation.outputPorts[0]!.valueType = "artifact";
    f.pipeline.graph.outputs[0]!.port.valueType = "artifact";
  }
  f.prepared.pipeline = f.pipeline;
  f.prepared.operations = [f.operation];
  f.prepared.resolvedNodes.identity!.timeouts.activeRunTimeoutMs = 30_000;
  f.prepared.resolvedNodes.identity!.timeouts.waitingTimeoutMs = 20_000;
  f.prepared.contentHash = hashPreparedRun(f.prepared);
  await requests.saveOperation(f.principal.workspaceId, f.operation, 0);
  const { id, apiVersion, revision: _revision, ...definition } = f.pipeline;
  await requests.savePipeline(f.principal.workspaceId, {
    apiVersion,
    pipelineId: id,
    expectedRevision: 0,
    definition,
  });
  const receipt = await requests.submitRun(
    f.principal,
    f.input,
    hashExecutionJson(f.input),
    f.prepared,
    60_000,
  );
  if (receipt.state !== "accepted") throw new Error("Missing queued Job");

  return { ...f, jobId: receipt.jobId };
};
const claim = async (f: Awaited<ReturnType<typeof prepareJob>>) => {
  const row = await jobs.claimJob(f.principal, f.jobId, randomUUID(), 60_000);
  if (!row?.executorId) throw new Error("Job was not claimed");
  const lease: ExecutionLease = {
    jobId: row.id,
    workspaceId: row.workspaceId,
    subjectId: row.subjectId,
    executorId: row.executorId,
    generation: row.generation,
  };

  return { row, lease };
};
const artifact = (jobId: string, attemptId: string): ExecutionArtifact => ({
  artifactId: randomUUID(),
  jobId,
  nodeId: "identity",
  portId: "value",
  attemptId,
  name: "report.txt",
  mimeType: "text/plain",
  sizeBytes: 4,
  sha256: hashExecutionJson("data"),
  state: "validated",
  createdAt: new Date().toISOString(),
});

describe("execution Job leases with isolated PostgreSQL", () => {
  it("bounds concurrent runtime logs without preventing failure convergence", async () => {
    const f = await prepareJob();
    const { row, lease } = await claim(f);
    const bounded = createExecutionJobRepository(db, {
      maxRuntimeEvents: 1,
      maxRuntimeEventBytes: 100,
    });
    const outcomes = await Promise.allSettled([
      bounded.appendEvent(lease, { type: "runtime_text", payload: { text: "first" } }),
      bounded.appendEvent(lease, { type: "runtime_text", payload: { text: "second" } }),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const logged = await requests.getJob(f.principal, f.jobId);
    expect(logged).toMatchObject({ runtimeEventCount: 1, revision: row.revision });
    await bounded.recordNodeState(lease, "identity", "failed", { reason: "log_quota" });
    await expect(bounded.finishJob(lease, { state: "failed" })).resolves.toMatchObject({
      state: "failed",
    });
  });
  beforeAll(async () => {
    const [identity] = await client`SELECT current_database() AS name`;
    expect(identity?.name).toBe("ordine_pipeline_v2_r5");
    await client.unsafe(`CREATE SCHEMA "${namespace}"`);
    await client.begin(async (tx) => {
      for (const statement of readFileSync(migrationPath, "utf8")
        .split("--> statement-breakpoint")
        .filter((part) => part.trim()))
        await tx.unsafe(statement);
    });
  });
  afterAll(async () => {
    await client.end();
  });

  it("allows one of two executors to claim a queued Job", async () => {
    const f = await prepareJob();
    const contenders = await Promise.all([
      jobs.claimJob(f.principal, f.jobId, "worker-a", 60_000),
      jobs.claimJob(f.principal, f.jobId, "worker-b", 60_000),
    ]);
    expect(contenders.filter(Boolean)).toHaveLength(1);
    const claimed = contenders.find(Boolean)!;
    expect(claimed).toMatchObject({
      state: "running",
      generation: 1,
      revision: 1,
      activeRemainingMs: 30_000,
      waitingRemainingMs: 20_000,
    });
    expect(await jobs.claimNext(f.principal.workspaceId, "worker-c", 60_000)).toBeNull();
  });

  it("rejects old generations and never resurrects expired leases", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    expect(await jobs.heartbeat({ ...lease, generation: 0 }, 60_000)).toBeNull();
    await expect(
      jobs.appendEvent(
        { ...lease, generation: 0 },
        { type: "runtime_text", payload: { text: "late" } },
      ),
    ).rejects.toMatchObject({ name: "ExecutionLeaseLostError" });
    await client`UPDATE execution_jobs SET lease_expires_at=clock_timestamp() - interval '1 millisecond' WHERE id=${f.jobId}`;
    expect(await jobs.heartbeat(lease, 60_000)).toBeNull();
    await expect(
      jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 }),
    ).rejects.toMatchObject({ name: "ExecutionLeaseLostError" });
  });

  it("records cancellation before cleanup and prevents cancellation-to-success reversal", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    const attempt = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    expect(await jobs.requestControl(f.principal, f.jobId, "cancel")).toMatchObject({
      state: "cancelling",
      stopReason: "cancelled",
    });
    await expect(jobs.finishJob(lease, { state: "succeeded", outputs: {} })).rejects.toMatchObject({
      name: "ExecutionJobStateConflictError",
    });
    await jobs.finishAttempt(lease, attempt.id, { state: "cancelled" });
    const ended = await jobs.finishJob(lease, { state: "cancelled" });
    expect(ended.state).toBe("cancelled");
    await expect(jobs.finishJob(lease, { state: "succeeded" })).rejects.toMatchObject({
      name: "ExecutionLeaseLostError",
    });
    expect(await jobs.heartbeat(lease, 60_000)).toBeNull();
  });

  it("lets cancellation race completion without terminal reversal", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    const attempt = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    await jobs.finishAttempt(lease, attempt.id, {
      state: "succeeded",
      outputs: { value: [{ kind: "text", value: "done" }] },
    });
    const results = await Promise.allSettled([
      jobs.requestControl(f.principal, f.jobId, "cancel"),
      jobs.finishJob(lease, { state: "succeeded", outputs: {} }),
    ]);
    const row = await requests.getJob(f.principal, f.jobId);
    expect(["cancelling", "succeeded"]).toContain(row?.state);
    if (row?.state === "cancelling") expect(results[1]?.status).toBe("rejected");
    else expect(results[1]?.status).toBe("fulfilled");
  });

  it("detects database deadlines while preserving an earlier cancellation decision", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    await client`UPDATE execution_jobs SET deadline_at=clock_timestamp() - interval '1 millisecond' WHERE id=${f.jobId}`;
    await expect(jobs.finishJob(lease, { state: "succeeded" })).rejects.toThrow();
    expect(await jobs.heartbeat(lease, 60_000)).toMatchObject({
      state: "cancelling",
      stopReason: "timed_out",
    });
    expect((await jobs.finishJob(lease, { state: "timed_out" })).state).toBe("timed_out");
    const g = await prepareJob();
    const owned = await claim(g);
    await jobs.requestControl(g.principal, g.jobId, "cancel");
    await client`UPDATE execution_jobs SET deadline_at=clock_timestamp() - interval '1 millisecond' WHERE id=${g.jobId}`;
    expect(await jobs.heartbeat(owned.lease, 60_000)).toMatchObject({
      state: "cancelling",
      stopReason: "cancelled",
    });
  });

  it("freezes active time and never resets the cumulative waiting budget", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    await jobs.requestControl(f.principal, f.jobId, "pause");
    const paused = await jobs.enterWaiting(lease, "paused");
    expect(paused.state).toBe("paused");
    expect(paused.deadlineAt).toBeNull();
    expect(paused.activeRemainingMs).toBeLessThanOrEqual(30_000);
    await client`UPDATE execution_jobs SET waiting_deadline_at=clock_timestamp() + interval '500 milliseconds' WHERE id=${f.jobId}`;
    const resumed = await jobs.requestControl(f.principal, f.jobId, "resume");
    expect(resumed.state).toBe("running");
    expect(resumed.waitingRemainingMs).toBeLessThanOrEqual(500);
    await jobs.requestControl(f.principal, f.jobId, "pause");
    const secondPause = await jobs.enterWaiting(lease, "paused");
    expect(secondPause.waitingRemainingMs).toBeLessThanOrEqual(500);
    expect(secondPause.activeRemainingMs).toBeLessThanOrEqual(paused.activeRemainingMs);
  });

  it("cannot confirm pause while attempts are still running", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    const attempt = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    await jobs.requestControl(f.principal, f.jobId, "pause");
    await expect(jobs.enterWaiting(lease, "paused")).rejects.toMatchObject({
      name: "ExecutionJobStateConflictError",
    });
    await jobs.finishAttempt(lease, attempt.id, {
      state: "succeeded",
      outputs: { value: [{ kind: "text", value: "ok" }] },
    });
    expect((await jobs.enterWaiting(lease, "paused")).state).toBe("paused");
  });

  it("persists one checkpoint acknowledgement and preserves a user pause", async () => {
    const f = await prepareJob({ checkpoint: true });
    const { lease } = await claim(f);
    await jobs.recordNodeState(lease, "identity", "waiting_for_input");
    await jobs.enterWaiting(lease, "waiting_for_input");
    await jobs.requestControl(f.principal, f.jobId, "pause");
    const acknowledgements = await Promise.all(
      Array.from({ length: 20 }, () =>
        jobs.acknowledgeCheckpoint(f.principal, f.jobId, "identity"),
      ),
    );
    expect(acknowledgements.every((job) => job.state === "paused")).toBe(true);
    expect(await jobs.hasCheckpointAcknowledgement(lease, "identity")).toBe(true);
    const events = await jobs.getEvents(f.principal, f.jobId, 0, 500);
    expect(events.filter((event) => event.type === "checkpoint_acknowledged")).toHaveLength(1);
    expect((await jobs.requestControl(f.principal, f.jobId, "resume")).state).toBe("running");
  });

  it("atomically completes output and publishes matching metadata for the current attempt", async () => {
    const f = await prepareJob({ artifact: true });
    const { lease } = await claim(f);
    const first = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    const oldArtifact = artifact(f.jobId, first.id);
    await jobs.registerArtifact(lease, { metadata: oldArtifact, storageKey: randomUUID() });
    await jobs.finishAttempt(lease, first.id, {
      state: "failed",
      error: { code: "TEMPORARY", message: "retry", retryable: true, stage: "execution" },
    });
    const second = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 2 });
    const current = artifact(f.jobId, second.id);
    await jobs.registerArtifact(lease, { metadata: current, storageKey: randomUUID() });
    const outputs = { value: [{ kind: "artifact" as const, artifactId: current.artifactId }] };
    await jobs.finishAttempt(lease, second.id, { state: "succeeded", outputs });
    const done = await jobs.finishJob(lease, {
      state: "succeeded",
      outputs,
      warnings: ["Optional warning"],
    });
    expect(done).toMatchObject({ state: "succeeded", warnings: ["Optional warning"] });
    expect((await requests.getPipelineRun(f.principal, f.jobId))?.outputs).toEqual(outputs);
    const published = await jobs.listArtifacts(f.principal, f.jobId);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      artifactId: current.artifactId,
      state: "published",
      metadata: { state: "published" },
    });
    expect((await jobs.getArtifact(f.principal, oldArtifact.artifactId))?.state).toBe("validated");
    await expect(
      jobs.registerArtifact(lease, {
        metadata: artifact(f.jobId, second.id),
        storageKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ name: "ExecutionLeaseLostError" });
  });

  it("rolls back Job, outputs, and publication if result persistence fails", async () => {
    const f = await prepareJob({ artifact: true });
    const { lease } = await claim(f);
    const attempt = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    const metadata = artifact(f.jobId, attempt.id);
    await jobs.registerArtifact(lease, { metadata, storageKey: randomUUID() });
    const outputs = { value: [{ kind: "artifact" as const, artifactId: metadata.artifactId }] };
    await jobs.finishAttempt(lease, attempt.id, { state: "succeeded", outputs });
    await client.unsafe(
      "ALTER TABLE execution_pipeline_runs ADD CONSTRAINT injected_null_outputs CHECK (outputs IS NULL) NOT VALID",
    );
    await expect(jobs.finishJob(lease, { state: "succeeded", outputs })).rejects.toMatchObject({
      cause: { code: "23514" },
    });
    await client.unsafe(
      "ALTER TABLE execution_pipeline_runs DROP CONSTRAINT injected_null_outputs",
    );
    expect((await requests.getJob(f.principal, f.jobId))?.state).toBe("running");
    expect((await requests.getPipelineRun(f.principal, f.jobId))?.outputs).toBeNull();
    expect((await jobs.getArtifact(f.principal, metadata.artifactId))?.metadata.state).toBe(
      "validated",
    );
  });

  it("recovers lost executors as interrupted and preserves never-started queued work", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    const attempt = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    await client`UPDATE execution_jobs SET lease_expires_at=clock_timestamp() - interval '1 millisecond' WHERE id=${f.jobId}`;
    const recovered = await jobs.recoverExpired(f.principal.workspaceId);
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.state).toBe("interrupted");
    expect(
      (await jobs.listAttempts(f.principal, f.jobId)).find((row) => row.id === attempt.id)?.state,
    ).toBe("interrupted");
    expect(await jobs.claimNext(f.principal.workspaceId, "replacement", 60_000)).toBeNull();
    const pending = await prepareJob();
    expect(await jobs.recoverExpired(pending.principal.workspaceId)).toEqual([]);
    expect((await jobs.claimNext(pending.principal.workspaceId, "replacement", 60_000))?.id).toBe(
      pending.jobId,
    );
  });

  it("keeps runtime text and heartbeat off Job revisions while semantic events advance them", async () => {
    const f = await prepareJob();
    const { row, lease } = await claim(f);
    await jobs.appendEvent(lease, {
      type: "runtime_text",
      nodeId: "identity",
      payload: { text: "hello" },
    });
    expect((await jobs.heartbeat(lease, 60_000))?.revision).toBe(row.revision);
    await jobs.recordNodeState(lease, "identity", "running");
    expect((await requests.getJob(f.principal, f.jobId))!.revision).toBeGreaterThan(row.revision);
    const stranger: ExecutionPrincipal = { ...f.principal, subjectId: "other" };
    await expect(jobs.requestControl(stranger, f.jobId, "cancel")).rejects.toMatchObject({
      name: "ExecutionNotFoundError",
    });
  });

  it("does not re-enter waiting after an acknowledgement races ahead of the worker", async () => {
    const f = await prepareJob({ checkpoint: true });
    const { lease } = await claim(f);
    await jobs.recordNodeState(lease, "identity", "waiting_for_input");
    await jobs.acknowledgeCheckpoint(f.principal, f.jobId, "identity");
    const continued = await jobs.enterWaiting(lease, "waiting_for_input");
    expect(continued.state).toBe("running");
    await expect(
      jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 }),
    ).resolves.toMatchObject({ state: "running" });
  });

  it("preserves a failed node projection when no attempt was started", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    await jobs.recordNodeState(lease, "identity", "failed", {
      reason: "checkpoint_callback_failed",
    });
    await jobs.finishJob(lease, { state: "failed" });
    const events = await jobs.getEvents(f.principal, f.jobId);
    const nodeStates = events.filter(
      (event) => event.nodeId === "identity" && event.type === "node_state",
    );
    expect(nodeStates.at(-1)?.payload).toMatchObject({
      state: "failed",
      reason: "checkpoint_callback_failed",
    });
  });

  it("keeps uncertain process termination interrupted after cancellation", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    await jobs.requestControl(f.principal, f.jobId, "cancel");
    const result = await jobs.finishJob(lease, { state: "interrupted" });
    expect(result).toMatchObject({ state: "interrupted", stopReason: "cancelled" });
    const attempts = await jobs.listAttempts(f.principal, f.jobId);
    expect(attempts[0]?.state).toBe("interrupted");
  });

  it("does not publish an artifact when the final best-effort node failed", async () => {
    const f = await prepareJob({ artifact: true, bestEffort: true });
    const { lease } = await claim(f);
    const attempt = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    const metadata = artifact(f.jobId, attempt.id);
    await jobs.registerArtifact(lease, { metadata, storageKey: randomUUID() });
    await jobs.finishAttempt(lease, attempt.id, {
      state: "succeeded",
      outputs: { value: [{ kind: "artifact", artifactId: metadata.artifactId }] },
    });
    await jobs.recordNodeState(lease, "identity", "failed", { reason: "LOOP_LIMIT_REACHED" });
    await jobs.finishJob(lease, { state: "succeeded", warnings: ["Optional loop failed"] });
    expect(await jobs.listArtifacts(f.principal, f.jobId)).toEqual([]);
    expect(await jobs.getProducedArtifact(f.principal, metadata.artifactId)).toBeNull();
  });

  it("fences internal artifact reads and enforces the aggregate Job quota", async () => {
    const f = await prepareJob({ artifact: true });
    const { lease } = await claim(f);
    const attempt = await jobs.startAttempt(lease, { nodeId: "identity", attemptNumber: 1 });
    const metadata = artifact(f.jobId, attempt.id);
    const bounded = createExecutionJobRepository(db, { maxJobArtifactBytes: 4 });
    await bounded.registerArtifact(lease, { metadata, storageKey: randomUUID() });
    expect(await jobs.getProducedArtifact(f.principal, metadata.artifactId)).toBeNull();
    await expect(
      jobs.getProducedArtifact(f.principal, metadata.artifactId, { lease }),
    ).resolves.toMatchObject({ artifactId: metadata.artifactId });
    await expect(
      bounded.registerArtifact(lease, {
        metadata: artifact(f.jobId, attempt.id),
        storageKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ name: "ExecutionIntegrityError" });
    await jobs.assertArtifactLease({ lease, nodeId: "identity", attemptId: attempt.id });
    await jobs.requestControl(f.principal, f.jobId, "cancel");
    await expect(
      jobs.assertArtifactLease({ lease, nodeId: "identity", attemptId: attempt.id }),
    ).rejects.toThrow();
    await expect(
      jobs.getProducedArtifact(f.principal, metadata.artifactId, { lease }),
    ).rejects.toThrow();
  });

  it("rolls back a pause transaction that crosses the original active deadline", async () => {
    const f = await prepareJob();
    const { lease } = await claim(f);
    await jobs.requestControl(f.principal, f.jobId, "pause");
    await client.unsafe(
      `CREATE FUNCTION delay_pause() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.job_id='${f.jobId}' AND NEW.payload->>'action'='enter_waiting' THEN PERFORM pg_sleep(0.3); END IF; RETURN NEW; END $$`,
    );
    await client.unsafe(
      "CREATE TRIGGER delay_pause BEFORE INSERT ON execution_events FOR EACH ROW EXECUTE FUNCTION delay_pause()",
    );
    await client`UPDATE execution_jobs SET deadline_at=clock_timestamp() + interval '200 milliseconds' WHERE id=${f.jobId}`;
    await expect(jobs.enterWaiting(lease, "paused")).rejects.toMatchObject({
      name: "ExecutionJobDeadlineError",
    });
    const stored = await requests.getJob(f.principal, f.jobId);
    expect(stored?.state).toBe("pausing");
    expect(stored?.deadlineAt).not.toBeNull();
    await expect(jobs.heartbeat(lease, 60_000)).resolves.toMatchObject({
      state: "cancelling",
      stopReason: "timed_out",
    });
  });
});
