import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@repo/db-schema";
import type { ExecutionInputArtifactSnapshot, ExecutionPrincipal } from "@repo/schemas";
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from "vitest";
import type { DbConnection } from "../../types";
import { createExecutionRepository } from "./executionRepository";
import { executionFixture } from "./executionFixtures";
import { hashExecutionJson, hashPreparedRun } from "./executionHash";

const databaseUrl = process.env.ORDINE_EXECUTION_TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error("Set ORDINE_EXECUTION_TEST_DATABASE_URL to the explicitly isolated R5 database");
const target = new URL(databaseUrl);
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "36435" ||
  target.pathname !== "/ordine_pipeline_v2_r5"
)
  throw new Error("Refusing unapproved execution integration database");
const namespace = `execution_r5_${randomUUID().replaceAll("-", "")}`;
const sql = postgres(databaseUrl, {
  max: 24,
  connection: { search_path: namespace },
  onnotice: () => {},
});
const repository = createExecutionRepository(drizzle(sql) as DbConnection);
const migrationPath = join(
  import.meta.dirname,
  "../../../../..",
  "apps/create/migrations-v2/0001_execution.sql",
);

const seed = async (approval = false, fixture = executionFixture(approval)) => {
  await repository.saveOperation(fixture.principal.workspaceId, fixture.operation, 0);
  const { id, revision: _revision, apiVersion, ...definition } = fixture.pipeline;
  await repository.savePipeline(fixture.principal.workspaceId, {
    apiVersion,
    pipelineId: id,
    expectedRevision: 0,
    definition,
  });

  return fixture;
};

const artifactFixture = (
  snapshot: ExecutionInputArtifactSnapshot,
  principal?: ExecutionPrincipal,
) => {
  const f = executionFixture(true);
  if (principal) f.principal = principal;
  f.operation.inputPorts = f.operation.inputPorts.map((port) => ({
    ...port,
    valueType: "artifact",
  }));
  f.operation.outputPorts = f.operation.outputPorts.map((port) => ({
    ...port,
    valueType: "artifact",
  }));
  f.pipeline.graph.inputs = f.pipeline.graph.inputs.map((port) => ({
    ...port,
    valueType: "artifact",
  }));
  f.pipeline.graph.outputs = f.pipeline.graph.outputs.map((output) => ({
    ...output,
    port: { ...output.port, valueType: "artifact" },
  }));
  f.input.inputs = { value: [{ kind: "artifact", artifactId: snapshot.artifactId }] };
  f.prepared.subjectId = f.principal.subjectId;
  f.prepared.workspaceId = f.principal.workspaceId;
  f.prepared.pipeline = f.pipeline;
  f.prepared.operations = [f.operation];
  f.prepared.inputs = f.input.inputs;
  f.prepared.inputArtifacts = [snapshot];
  f.prepared.contentHash = hashPreparedRun(f.prepared);

  return f;
};

describe("execution repository with isolated real PostgreSQL", () => {
  it("atomically bounds pending requests while allowing replay and released capacity", async () => {
    const f = await seed(true);
    const bounded = createExecutionRepository(drizzle(sql) as DbConnection, {
      maxPendingRequests: 1,
    });
    const secondInput = { ...f.input, requestId: randomUUID() };
    const secondPrepared = { ...f.prepared, id: randomUUID() };
    const outcomes = await Promise.allSettled([
      bounded.submitRun(f.principal, f.input, hashExecutionJson(f.input), f.prepared, 60_000),
      bounded.submitRun(
        f.principal,
        secondInput,
        hashExecutionJson(secondInput),
        secondPrepared,
        60_000,
      ),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { name: "ExecutionCapacityError" },
    });
    const winner = outcomes.find((result) => result.status === "fulfilled");
    if (!winner || winner.status !== "fulfilled" || winner.value.state !== "awaiting_approval")
      throw new Error("Missing pending winner");
    const chosenInput = winner.value.requestId === f.input.requestId ? f.input : secondInput;
    await expect(
      bounded.replayRunRequest(f.principal, chosenInput, hashExecutionJson(chosenInput)),
    ).resolves.toEqual(winner.value);
    await bounded.reject(f.principal, winner.value.approvalId);
    const nextInput = { ...f.input, requestId: randomUUID() };
    await expect(
      bounded.submitRun(
        f.principal,
        nextInput,
        hashExecutionJson(nextInput),
        { ...f.prepared, id: randomUUID() },
        60_000,
      ),
    ).resolves.toMatchObject({ state: "awaiting_approval" });
  });
  it("binds input asset fingerprints and rechecks them at approval", async () => {
    const snapshot: ExecutionInputArtifactSnapshot = {
      artifactId: `input-${randomUUID()}`,
      name: "source.txt",
      mimeType: "text/plain",
      sizeBytes: 4,
      sha256: hashExecutionJson("data"),
      source: { kind: "input_asset" },
    };
    const f = await seed(true, artifactFixture(snapshot));
    const principal = {
      ...f.principal,
      scopes: [...f.principal.scopes, "artifacts:import" as const],
    };
    const { source: _source, ...fields } = snapshot;
    await repository.createInputAsset(principal, {
      artifactId: snapshot.artifactId,
      storageKey: `inputs/${randomUUID()}`,
      importRequestId: randomUUID(),
      inputHash: hashExecutionJson(snapshot),
      metadata: {
        ...fields,
        workspaceId: principal.workspaceId,
        subjectId: principal.subjectId,
        createdAt: new Date().toISOString(),
      },
    });
    const pending = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    if (pending.state !== "awaiting_approval") throw new Error("Missing approval");
    const stored = await repository.getPrepared(f.principal, f.prepared.id);
    expect(stored?.inputArtifacts).toEqual([snapshot]);
    const other = await seed(
      true,
      artifactFixture(snapshot, { ...f.principal, subjectId: "other-subject" }),
    );
    await expect(
      repository.submitRun(
        other.principal,
        other.input,
        hashExecutionJson(other.input),
        other.prepared,
        60_000,
      ),
    ).rejects.toMatchObject({ name: "ExecutionNotFoundError" });
    await sql`UPDATE execution_input_assets SET metadata=jsonb_set(metadata,'{sha256}',to_jsonb(${"f".repeat(64)}::text)) WHERE artifact_id=${snapshot.artifactId}`;
    await expect(repository.approve(f.principal, pending.approvalId)).rejects.toMatchObject({
      name: "ExecutionIntegrityError",
    });
  });

  it("accepts only published artifacts from successful Jobs owned by the requester", async () => {
    const source = await seed();
    const receipt = await repository.submitRun(
      source.principal,
      source.input,
      hashExecutionJson(source.input),
      source.prepared,
      60_000,
    );
    if (receipt.state !== "accepted") throw new Error("Missing source job");
    const attemptId = randomUUID();
    const snapshot: ExecutionInputArtifactSnapshot = {
      artifactId: randomUUID(),
      name: "report.txt",
      mimeType: "text/plain",
      sizeBytes: 4,
      sha256: hashExecutionJson("data"),
      source: {
        kind: "job_artifact",
        jobId: receipt.jobId,
        nodeId: "identity",
        portId: "value",
        attemptId,
      },
    };
    const metadata = {
      artifactId: snapshot.artifactId,
      name: snapshot.name,
      mimeType: snapshot.mimeType,
      sizeBytes: snapshot.sizeBytes,
      sha256: snapshot.sha256,
      jobId: receipt.jobId,
      nodeId: "identity",
      portId: "value",
      attemptId,
      state: "staged",
      createdAt: new Date().toISOString(),
    };
    await sql`UPDATE execution_jobs SET state='succeeded' WHERE id=${receipt.jobId}`;
    await sql`INSERT INTO execution_node_attempts (id,job_id,node_id,attempt_number,state) VALUES (${attemptId},${receipt.jobId},'identity',1,'succeeded')`;
    await sql`INSERT INTO execution_artifacts (artifact_id,job_id,node_id,port_id,attempt_id,metadata,storage_key,state) VALUES (${snapshot.artifactId},${receipt.jobId},'identity','value',${attemptId},${JSON.stringify(metadata)}::jsonb,${randomUUID()},'staged')`;
    const target = await seed(true, artifactFixture(snapshot, source.principal));
    await expect(
      repository.submitRun(
        target.principal,
        target.input,
        hashExecutionJson(target.input),
        target.prepared,
        60_000,
      ),
    ).rejects.toMatchObject({ name: "ExecutionIntegrityError" });
    await sql`UPDATE execution_artifacts SET state='published',metadata=jsonb_set(metadata,'{state}','"published"'::jsonb) WHERE artifact_id=${snapshot.artifactId}`;
    const pending = await repository.submitRun(
      target.principal,
      target.input,
      hashExecutionJson(target.input),
      target.prepared,
      60_000,
    );
    if (pending.state !== "awaiting_approval") throw new Error("Missing target approval");
    await sql`UPDATE execution_jobs SET state='cancelled' WHERE id=${receipt.jobId}`;
    await expect(repository.approve(target.principal, pending.approvalId)).rejects.toMatchObject({
      name: "ExecutionIntegrityError",
    });
  });
  it("stores runtime configurations and defaults in new tables with workspace CAS", async () => {
    const workspaceId = `workspace-${randomUUID()}`;
    const config = {
      id: "runtime-codex",
      name: "Codex",
      type: "codex" as const,
      connection: { mode: "local" as const, path: "C:/runtime/codex.exe" },
    };
    const first = await repository.saveRuntimeConfig(workspaceId, config, 0);
    expect(first.revision).toBe(1);
    expect(await repository.getRuntimeConfig(workspaceId, config.id)).toEqual(first);
    expect(await repository.listRuntimeConfigs(workspaceId)).toEqual([first]);
    expect(await repository.getRuntimeConfig("other-workspace", config.id)).toBeNull();
    const contenders = await Promise.allSettled([
      repository.saveRuntimeConfig(workspaceId, { ...config, name: "A" }, 1),
      repository.saveRuntimeConfig(workspaceId, { ...config, name: "B" }, 1),
    ]);
    expect(contenders.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const settings = await repository.saveWorkspaceSettings(
      workspaceId,
      { firstOutputTimeoutMs: 0 },
      0,
    );
    expect(settings).toMatchObject({ revision: 1, executionDefaults: { firstOutputTimeoutMs: 0 } });
    expect(await repository.getWorkspaceSettings(workspaceId)).toEqual(settings);
    expect(await repository.listWorkspaceSettings(workspaceId)).toEqual([settings]);
    await expect(repository.saveWorkspaceSettings(workspaceId, {}, 0)).rejects.toMatchObject({
      name: "ExecutionRevisionConflictError",
    });
    const secretConfig = {
      ...config,
      connection: { ...config.connection, apiKey: "must-not-persist" },
    };
    await expect(repository.saveRuntimeConfig(workspaceId, secretConfig, 2)).rejects.toThrow();
    const secretDefaults = { firstOutputTimeoutMs: 0, token: "must-not-persist" };
    await expect(
      repository.saveWorkspaceSettings(workspaceId, secretDefaults, 1),
    ).rejects.toThrow();
  });
  beforeAll(async () => {
    const [identity] = await sql`SELECT current_database() AS database`;
    expect(identity?.database).toBe("ordine_pipeline_v2_r5");
    await sql.unsafe(`CREATE SCHEMA "${namespace}"`);
    await sql.begin(async (tx) => {
      for (const statement of readFileSync(migrationPath, "utf8")
        .split("--> statement-breakpoint")
        .filter((part) => part.trim()))
        await tx.unsafe(statement);
    });
  });
  afterAll(async () => {
    await sql.end();
  });

  it("matches every execution Drizzle column and named FK/index in the bootstrap", async () => {
    const tables = Object.entries(schema).filter(
      ([name]) => name.startsWith("execution") && name.endsWith("Table"),
    );
    expect(tables).toHaveLength(14);
    for (const [, table] of tables) {
      const config = getTableConfig(table as Parameters<typeof getTableConfig>[0]);
      const columns =
        await sql`SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema=${namespace} AND table_name=${config.name}`;
      expect(columns.map((row) => row.column_name).sort()).toEqual(
        config.columns.map((column) => column.name).sort(),
      );
      for (const column of config.columns) {
        const actual = columns.find((row) => row.column_name === column.name)!;
        expect(actual.is_nullable).toBe(column.notNull ? "NO" : "YES");
        if (column.getSQLType().startsWith("timestamp"))
          expect(actual.data_type).toBe("timestamp with time zone");
      }
      const constraints =
        await sql`SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema=${namespace} AND table_name=${config.name}`;
      for (const fk of config.foreignKeys)
        expect(constraints.some((row) => row.constraint_name === fk.getName())).toBe(true);
      for (const check of config.checks)
        expect(constraints.some((row) => row.constraint_name === check.name)).toBe(true);
      const indexes =
        await sql`SELECT indexname FROM pg_indexes WHERE schemaname=${namespace} AND tablename=${config.name}`;
      for (const index of config.indexes)
        expect(indexes.some((row) => row.indexname === index.config.name)).toBe(true);
    }
  });

  it("stores input assets without fake Jobs and replays only matching imports", async () => {
    const f = executionFixture();
    const data = {
      artifactId: `input-${randomUUID()}`,
      storageKey: `inputs/${randomUUID()}`,
      importRequestId: randomUUID(),
      inputHash: hashExecutionJson({ filename: "source.txt", content: "hello" }),
      metadata: {
        artifactId: "placeholder",
        subjectId: f.principal.subjectId,
        workspaceId: f.principal.workspaceId,
        name: "source.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        sha256: hashExecutionJson("hello"),
        createdAt: new Date().toISOString(),
      },
    };
    data.metadata.artifactId = data.artifactId;
    const principal = {
      ...f.principal,
      scopes: [...f.principal.scopes, "artifacts:import" as const],
    };
    const rows = await Promise.all(
      Array.from({ length: 20 }, () => repository.createInputAsset(principal, data)),
    );
    expect(new Set(rows.map((row) => row.artifactId)).size).toBe(1);
    expect(await repository.getInputAsset(principal, data.artifactId)).toEqual(rows[0]);
    expect(
      await repository.getInputAsset({ ...principal, subjectId: "other" }, data.artifactId),
    ).toBeNull();
    await expect(
      repository.createInputAsset(principal, {
        ...data,
        inputHash: hashExecutionJson("different"),
      }),
    ).rejects.toMatchObject({ name: "ExecutionIdempotencyConflictError" });
    const [counts] =
      await sql`SELECT count(*)::int AS jobs FROM execution_jobs WHERE workspace_id=${principal.workspaceId}`;
    expect(counts?.jobs).toBe(0);
  });

  it("rejects legacy state writes through database CHECK constraints", async () => {
    const f = await seed(true);
    const pending = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    if (pending.state !== "awaiting_approval") throw new Error("Missing approval");
    await expect(
      sql`UPDATE execution_approvals SET state='consumed' WHERE id=${pending.approvalId}`,
    ).rejects.toMatchObject({ code: "23514" });
    const accepted = await repository.approve(f.principal, pending.approvalId);
    if (accepted.state !== "accepted") throw new Error("Missing job");
    await expect(
      sql`UPDATE execution_jobs SET state='done' WHERE id=${accepted.jobId}`,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql`UPDATE execution_run_requests SET state='done' WHERE request_id=${f.input.requestId}`,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql`INSERT INTO execution_node_attempts (id, job_id, node_id, attempt_number, state) VALUES (${randomUUID()},${accepted.jobId},'identity',1,'paused')`,
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("serializes 20 identical request IDs into one snapshot, job, run, and receipt", async () => {
    const f = await seed();
    const receipts = await Promise.all(
      Array.from({ length: 20 }, () =>
        repository.submitRun(f.principal, f.input, hashExecutionJson(f.input), f.prepared, 60_000),
      ),
    );
    expect(new Set(receipts.map((receipt) => JSON.stringify(receipt))).size).toBe(1);
    expect(receipts[0]?.state).toBe("accepted");
    const [counts] =
      await sql`SELECT (SELECT count(*)::int FROM execution_prepared_runs WHERE workspace_id=${f.principal.workspaceId}) AS prepared, (SELECT count(*)::int FROM execution_jobs WHERE workspace_id=${f.principal.workspaceId}) AS jobs, (SELECT count(*)::int FROM execution_pipeline_runs WHERE prepared_run_id=${f.prepared.id}) AS runs`;
    expect(counts).toEqual({ prepared: 1, jobs: 1, runs: 1 });
    expect(await repository.findRequest(f.principal, f.input.requestId)).toEqual(receipts[0]);
    const alteredDefaults = {
      ...f.prepared,
      id: `unused-${randomUUID()}`,
      resolvedNodes: {
        identity: {
          ...f.prepared.resolvedNodes.identity!,
          timeouts: {
            ...f.prepared.resolvedNodes.identity!.timeouts,
            inactivityTimeoutMs: 120_000,
          },
        },
      },
    };
    alteredDefaults.contentHash = hashPreparedRun(alteredDefaults);
    expect(
      await repository.submitRun(
        f.principal,
        f.input,
        hashExecutionJson(f.input),
        alteredDefaults,
        60_000,
      ),
    ).toEqual(receipts[0]);
  });

  it("rejects same request ID with changed arguments and spoofed input hashes", async () => {
    const f = await seed();
    await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    const input = { ...f.input, inputs: { value: [{ kind: "text" as const, value: "changed" }] } };
    await expect(
      repository.submitRun(f.principal, input, hashExecutionJson(input), f.prepared, 60_000),
    ).rejects.toMatchObject({ name: "ExecutionIdempotencyConflictError" });
    await expect(
      repository.submitRun(f.principal, input, hashExecutionJson(f.input), f.prepared, 60_000),
    ).rejects.toMatchObject({ name: "ExecutionIntegrityError" });
  });

  it("approves the original pinned Operation after newer revisions are saved", async () => {
    const f = await seed(true);
    const pending = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    expect(pending.state).toBe("awaiting_approval");
    if (pending.state !== "awaiting_approval") throw new Error("Missing approval");
    const [before] =
      await sql`SELECT count(*)::int AS jobs FROM execution_jobs WHERE workspace_id=${f.principal.workspaceId}`;
    expect(before?.jobs).toBe(0);
    await repository.saveOperation(
      f.principal.workspaceId,
      { ...f.operation, revision: 2, name: "Changed default" },
      1,
    );
    const accepted = await repository.approve(f.principal, pending.approvalId);
    expect(accepted.state).toBe("accepted");
    expect(await repository.approve(f.principal, pending.approvalId)).toEqual(accepted);
    const stored = await repository.getPrepared(f.principal, f.prepared.id);
    expect(stored?.operations[0]?.revision).toBe(1);
    expect(stored?.operations[0]?.name).toBe("Identity");
  });

  it("allows only one winner between approving and rejecting", async () => {
    const f = await seed(true);
    const pending = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    if (pending.state !== "awaiting_approval") throw new Error("Missing approval");
    const results = await Promise.allSettled([
      repository.approve(f.principal, pending.approvalId),
      repository.reject(f.principal, pending.approvalId),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const receipt = await repository.findRequest(f.principal, f.input.requestId);
    expect(["accepted", "rejected"]).toContain(receipt?.state);
    const [counts] =
      await sql`SELECT count(*)::int AS jobs FROM execution_jobs WHERE workspace_id=${f.principal.workspaceId}`;
    expect(counts?.jobs).toBe(receipt?.state === "accepted" ? 1 : 0);
  });

  it("uses database time for expiry and rejects another subject", async () => {
    const f = await seed(true);
    const pending = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    if (pending.state !== "awaiting_approval") throw new Error("Missing approval");
    await expect(
      repository.approve({ ...f.principal, subjectId: "other" }, pending.approvalId),
    ).rejects.toMatchObject({ name: "ExecutionNotFoundError" });
    await sql`UPDATE execution_approvals SET expires_at=clock_timestamp() - interval '1 second' WHERE id=${pending.approvalId}`;
    await expect(repository.approve(f.principal, pending.approvalId)).rejects.toMatchObject({
      name: "ExecutionApprovalExpiredError",
    });
    const [counts] =
      await sql`SELECT count(*)::int AS jobs FROM execution_jobs WHERE workspace_id=${f.principal.workspaceId}`;
    expect(counts?.jobs).toBe(0);
  });

  it("detects stored snapshot tampering on read and approval", async () => {
    const f = await seed(true);
    const pending = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    if (pending.state !== "awaiting_approval") throw new Error("Missing approval");
    await sql`UPDATE execution_prepared_runs SET prepared=jsonb_set(prepared, '{pipeline,sharedContext}', '"tampered"'::jsonb) WHERE id=${f.prepared.id}`;
    await expect(repository.getPrepared(f.principal, f.prepared.id)).rejects.toMatchObject({
      name: "ExecutionIntegrityError",
    });
    await expect(repository.approve(f.principal, pending.approvalId)).rejects.toMatchObject({
      name: "ExecutionIntegrityError",
    });
  });

  it("converges expired approvals during request lookup without starting a Job", async () => {
    const f = await seed(true);
    const pending = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    if (pending.state !== "awaiting_approval") throw new Error("Missing approval");
    await sql`UPDATE execution_approvals SET expires_at=clock_timestamp() - interval '1 second' WHERE id=${pending.approvalId}`;
    const view = await repository.findRequest(f.principal, f.input.requestId);
    expect(view?.state).toBe("expired");
    const [unmodified] =
      await sql`SELECT state FROM execution_run_requests WHERE request_id=${f.input.requestId}`;
    expect(unmodified?.state).toBe("awaiting_approval");
    const expired = await repository.replayRunRequest(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
    );
    expect(expired?.state).toBe("expired");
    expect(
      await repository.submitRun(
        f.principal,
        f.input,
        hashExecutionJson(f.input),
        f.prepared,
        60_000,
      ),
    ).toEqual(expired);
    await expect(repository.approve(f.principal, pending.approvalId)).rejects.toMatchObject({
      name: "ExecutionApprovalExpiredError",
    });
  });

  it("replays validated requests before preparing files and rejects changed hashes", async () => {
    const f = await seed();
    expect(
      await repository.replayRunRequest(f.principal, f.input, hashExecutionJson(f.input)),
    ).toBeNull();
    const receipt = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    expect(
      await repository.replayRunRequest(f.principal, f.input, hashExecutionJson(f.input)),
    ).toEqual(receipt);
    const changed = { ...f.input, executionOverrides: { firstOutputTimeoutMs: 0 } };
    await expect(
      repository.replayRunRequest(f.principal, changed, hashExecutionJson(changed)),
    ).rejects.toMatchObject({ name: "ExecutionIdempotencyConflictError" });
    await expect(
      repository.replayRunRequest(f.principal, f.input, "0".repeat(64)),
    ).rejects.toMatchObject({ name: "ExecutionIntegrityError" });
    await expect(
      repository.replayRunRequest(
        { ...f.principal, scopes: [] },
        f.input,
        hashExecutionJson(f.input),
      ),
    ).rejects.toMatchObject({ name: "ExecutionScopeError" });
  });

  it("rejects snapshot identity and input mismatch before persisting anything", async () => {
    const f = await seed();
    const mismatched = { ...f.prepared, subjectId: "someone-else" };
    mismatched.contentHash = hashPreparedRun(mismatched);
    await expect(
      repository.submitRun(f.principal, f.input, hashExecutionJson(f.input), mismatched, 60_000),
    ).rejects.toMatchObject({ name: "ExecutionIntegrityError" });
    const differentInput = {
      ...f.prepared,
      inputs: { value: [{ kind: "text" as const, value: "wrong" }] },
    };
    differentInput.contentHash = hashPreparedRun(differentInput);
    await expect(
      repository.submitRun(
        f.principal,
        f.input,
        hashExecutionJson(f.input),
        differentInput,
        60_000,
      ),
    ).rejects.toMatchObject({ name: "ExecutionIntegrityError" });
    expect(await repository.findRequest(f.principal, f.input.requestId)).toBeNull();
    const [counts] =
      await sql`SELECT count(*)::int AS prepared FROM execution_prepared_runs WHERE workspace_id=${f.principal.workspaceId}`;
    expect(counts?.prepared).toBe(0);
  });

  it.each([
    "execution_prepared_runs",
    "execution_run_requests",
    "execution_jobs",
    "execution_pipeline_runs",
  ])("leaves no partial acceptance when the transaction connection dies at %s", async (table) => {
    const f = await seed();
    const name = `disconnect_${randomUUID().replaceAll("-", "")}`;
    await sql.unsafe(
      `CREATE FUNCTION "${namespace}"."${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_terminate_backend(pg_backend_pid()); RETURN NEW; END; $$`,
    );
    await sql.unsafe(
      `CREATE TRIGGER "${name}" BEFORE INSERT ON "${namespace}"."${table}" FOR EACH ROW EXECUTE FUNCTION "${namespace}"."${name}"()`,
    );
    onTestFinished(async () => {
      await sql.unsafe(`DROP TRIGGER "${name}" ON "${namespace}"."${table}"`);
      await sql.unsafe(`DROP FUNCTION "${namespace}"."${name}"()`);
    });
    const outcome = await new Promise<{ code: unknown; stdout: string }>((done) => {
      execFile(
        "bun",
        [
          join(import.meta.dirname, "connectionCrashChild.ts"),
          namespace,
          JSON.stringify({ principal: f.principal, input: f.input, prepared: f.prepared }),
        ],
        { windowsHide: true, timeout: 10_000, env: process.env },
        (error, stdout) => done({ code: error?.code ?? 0, stdout }),
      );
    });
    expect([0, 1]).toContain(outcome.code);
    expect(outcome.stdout).toContain("EXPECTED_CONNECTION_FAILURE");
    expect(await repository.findRequest(f.principal, f.input.requestId)).toBeNull();
    const [counts] =
      await sql`SELECT (SELECT count(*)::int FROM execution_prepared_runs WHERE workspace_id=${f.principal.workspaceId}) AS prepared, (SELECT count(*)::int FROM execution_jobs WHERE workspace_id=${f.principal.workspaceId}) AS jobs, (SELECT count(*)::int FROM execution_pipeline_runs WHERE prepared_run_id=${f.prepared.id}) AS runs`;
    expect(counts).toEqual({ prepared: 0, jobs: 0, runs: 0 });
  });

  it("rolls back the complete non-approval submission on a PipelineRun FK failure", async () => {
    const f = await seed();
    await sql.unsafe("CREATE TABLE injected_new_missing_prepared (id text PRIMARY KEY)");
    await sql.unsafe(
      "ALTER TABLE execution_pipeline_runs ADD CONSTRAINT injected_new_prepared_fk FOREIGN KEY (prepared_run_id) REFERENCES injected_new_missing_prepared(id) NOT VALID",
    );
    await expect(
      repository.submitRun(f.principal, f.input, hashExecutionJson(f.input), f.prepared, 60_000),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
    await sql.unsafe(
      "ALTER TABLE execution_pipeline_runs DROP CONSTRAINT injected_new_prepared_fk",
    );
    expect(await repository.findRequest(f.principal, f.input.requestId)).toBeNull();
    const [counts] =
      await sql`SELECT (SELECT count(*)::int FROM execution_prepared_runs WHERE workspace_id=${f.principal.workspaceId}) AS prepared, (SELECT count(*)::int FROM execution_jobs WHERE workspace_id=${f.principal.workspaceId}) AS jobs, (SELECT count(*)::int FROM execution_pipeline_runs WHERE prepared_run_id=${f.prepared.id}) AS runs`;
    expect(counts).toEqual({ prepared: 0, jobs: 0, runs: 0 });
  });

  it("prevents artifact references to another Job's node attempt", async () => {
    const f = await seed();
    const g = await seed();
    const first = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    const second = await repository.submitRun(
      g.principal,
      g.input,
      hashExecutionJson(g.input),
      g.prepared,
      60_000,
    );
    if (first.state !== "accepted" || second.state !== "accepted") throw new Error("Missing jobs");
    const attemptId = randomUUID();
    await sql`INSERT INTO execution_node_attempts (id,job_id,node_id,attempt_number) VALUES (${attemptId},${first.jobId},'identity',1)`;
    const artifactId = randomUUID();
    const metadata = {
      artifactId,
      jobId: second.jobId,
      nodeId: "identity",
      portId: "value",
      attemptId,
      name: "result.txt",
      mimeType: "text/plain",
      sizeBytes: 0,
      sha256: "0".repeat(64),
      state: "staged",
      createdAt: new Date().toISOString(),
    };
    await expect(
      sql`INSERT INTO execution_artifacts (artifact_id,job_id,node_id,port_id,attempt_id,metadata,storage_key) VALUES (${artifactId},${second.jobId},'identity','value',${attemptId},${JSON.stringify(metadata)}::jsonb,${randomUUID()})`,
    ).rejects.toMatchObject({ code: "23503" });
    expect(await repository.getJob(g.principal, first.jobId)).toBeNull();
    expect(await repository.getPipelineRun(g.principal, first.jobId)).toBeNull();
    await expect(
      sql`INSERT INTO execution_events (job_id,attempt_id,type,payload) VALUES (${second.jobId},${attemptId},'node_progress','{}'::jsonb)`,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql`INSERT INTO execution_events (job_id,node_id,attempt_id,type,payload) VALUES (${second.jobId},'identity',${attemptId},'node_progress','{}'::jsonb)`,
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rolls back the job and approval decision when PipelineRun violates a foreign key", async () => {
    const f = await seed(true);
    const pending = await repository.submitRun(
      f.principal,
      f.input,
      hashExecutionJson(f.input),
      f.prepared,
      60_000,
    );
    if (pending.state !== "awaiting_approval") throw new Error("Missing approval");
    await sql.unsafe("CREATE TABLE injected_missing_prepared (id text PRIMARY KEY)");
    await sql.unsafe(
      "ALTER TABLE execution_pipeline_runs ADD CONSTRAINT injected_prepared_fk FOREIGN KEY (prepared_run_id) REFERENCES injected_missing_prepared(id) NOT VALID",
    );
    await expect(repository.approve(f.principal, pending.approvalId)).rejects.toMatchObject({
      cause: { code: "23503" },
    });
    await sql.unsafe("ALTER TABLE execution_pipeline_runs DROP CONSTRAINT injected_prepared_fk");
    expect(await repository.findRequest(f.principal, f.input.requestId)).toEqual(pending);
    const [counts] =
      await sql`SELECT (SELECT count(*)::int FROM execution_jobs WHERE workspace_id=${f.principal.workspaceId}) AS jobs, (SELECT count(*)::int FROM execution_pipeline_runs WHERE prepared_run_id=${f.prepared.id}) AS runs, (SELECT state FROM execution_approvals WHERE id=${pending.approvalId}) AS approval`;
    expect(counts).toEqual({ jobs: 0, runs: 0, approval: "pending" });
  });

  it("enforces revision CAS and keeps older Operation revisions immutable", async () => {
    const f = await seed();
    const updates = await Promise.allSettled([
      repository.saveOperation(
        f.principal.workspaceId,
        { ...f.operation, revision: 2, name: "A" },
        1,
      ),
      repository.saveOperation(
        f.principal.workspaceId,
        { ...f.operation, revision: 2, name: "B" },
        1,
      ),
    ]);
    expect(updates.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const original = await repository.getOperationRevision(
      f.principal.workspaceId,
      f.operation.id,
      1,
    );
    expect(original?.name).toBe("Identity");
    const { id, revision: _revision, apiVersion, ...definition } = f.pipeline;
    await repository.savePipeline(f.principal.workspaceId, {
      apiVersion,
      pipelineId: id,
      expectedRevision: 1,
      definition: { ...definition, name: "Updated" },
    });
    await expect(
      repository.savePipeline(f.principal.workspaceId, {
        apiVersion,
        pipelineId: id,
        expectedRevision: 1,
        definition,
      }),
    ).rejects.toMatchObject({ name: "ExecutionRevisionConflictError" });
  });
});
