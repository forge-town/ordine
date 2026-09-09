import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { Result, ResultAsync } from "neverthrow";
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from "vitest";
import {
  createExecutionRepository,
  createExecutionJobRepository,
  type DbConnection,
} from "@repo/models";
import {
  ExecutionPrincipalSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  RunRequestInputSchema,
} from "@repo/schemas";
import { createExecutionArtifactStore } from "../executionArtifacts";
import { createExecutionPreparationService } from "./createExecutionPreparationService";
import { createExecutionApiService } from "./createExecutionApiService";
import { createExecutionJobRunner } from "./createExecutionJobRunner";

const databaseUrl = process.env.ORDINE_EXECUTION_TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error("An explicitly isolated execution integration database is required");
const target = new URL(databaseUrl);
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "36435" ||
  target.pathname !== "/ordine_pipeline_v2_r5"
)
  throw new Error("Refusing unapproved execution integration database");
const namespace = `execution_runtime_${randomUUID().replaceAll("-", "")}`;
const client = postgres(databaseUrl, {
  max: 24,
  connection: { search_path: namespace },
  onnotice: () => {},
});
const db = drizzle(client) as DbConnection;
const requests = createExecutionRepository(db);
const jobs = createExecutionJobRepository(db);
const evidenceRoot = join(process.env.ORDINE_EXECUTION_EVIDENCE_DIRECTORY ?? tmpdir(), namespace);
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 50));
const deferred = () => {
  const state: { resolve?: () => void } = {};
  const promise = new Promise<void>((resolve) => {
    state.resolve = resolve;
  });

  return { promise, resolve: () => state.resolve!() };
};
const until = async <T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  timeoutMs = 20_000,
) => {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() >= end) throw new Error("Timed out waiting for execution evidence");
    await delay();
  }
};
const processExists = (pid: number) =>
  Result.fromThrowable(
    () => process.kill(pid, 0),
    () => false,
  )().isOk();

const fixture = async (
  options: {
    source?: string;
    checkpoint?: boolean;
    builtin?: boolean;
    writer?: boolean;
    files?: boolean;
    leaseMs?: number;
  } = {},
) => {
  const id = randomUUID();
  const principal = ExecutionPrincipalSchema.parse({
    subjectId: `owner-${id}`,
    workspaceId: `workspace-${id}`,
    scopes: [
      "definitions:read",
      "definitions:write",
      "execution:submit",
      "execution:approve",
      "execution:read",
      "execution:control",
      "artifacts:read",
      "artifacts:import",
    ],
  });
  const directory = join(evidenceRoot, id);
  const store = (
    await createExecutionArtifactStore({
      rootDirectory: directory,
      persistence: {
        replayInputImport: requests.replayInputImport,
        createInputAsset: requests.createInputAsset,
        getInputAsset: requests.getInputAsset,
        getProducedArtifact: jobs.getProducedArtifact,
        registerArtifact: jobs.registerArtifact,
        assertLease: jobs.assertArtifactLease,
        assertJobLease: jobs.assertJobLease,
      },
    })
  )._unsafeUnwrap();
  const preparation = createExecutionPreparationService({
    repository: requests,
    artifactStore: store,
    scriptExecutables: { javascript: process.execPath },
  });
  const service = createExecutionApiService({
    repository: requests,
    jobs,
    artifactStore: store,
    preparation,
  });
  const trace: Array<Record<string, unknown>> = [];
  const traceStart = performance.now();
  const record = (event: string, detail: Record<string, unknown> = {}) =>
    trace.push({
      event,
      elapsedMs: performance.now() - traceStart,
      wallTime: new Date().toISOString(),
      ...detail,
    });
  const runner = createExecutionJobRunner({
    requests,
    jobs: {
      ...jobs,
      heartbeat: async (...args) => {
        const sentAt = performance.now();
        record("heartbeat_sent");
        const result = await ResultAsync.fromPromise(jobs.heartbeat(...args), (error) => error);
        record("heartbeat_returned", {
          elapsedSinceSentMs: performance.now() - sentAt,
          valid: result.isOk() && Boolean(result.value),
          ...(result.isOk() && result.value
            ? {
                databaseHeartbeatAt: result.value.heartbeatAt,
                leaseExpiresAt: result.value.leaseExpiresAt,
              }
            : {}),
          ...(result.isErr() ? { error: String(result.error) } : {}),
        });
        if (result.isErr()) throw result.error;

        return result.value;
      },
      startAttempt: async (...args) => {
        const attempt = await jobs.startAttempt(...args);
        record("attempt_started", { attemptId: args[1].id });

        return attempt;
      },
      appendEvent: async (...args) => {
        if (args[1].type === "process_result")
          record("process_result", { report: args[1].payload });

        return jobs.appendEvent(...args);
      },
    },
    artifactStore: store,
    leaseMs: options.leaseMs ?? 15_000,
    heartbeatMs: 200,
  });
  const port = { id: "value", valueType: "text", cardinality: "one" };
  const first = OperationRevisionSchema.parse({
    apiVersion: 2,
    id: `transform-${id}`,
    revision: 1,
    name: "Transform",
    inputPorts: [port],
    outputPorts: options.files
      ? ["left", "right"].map((id) => ({ id, valueType: "artifact", cardinality: "one" }))
      : [port],
    executor: options.builtin
      ? { kind: "builtin", name: "identity" }
      : {
          kind: "script",
          language: "javascript",
          outputMode: options.files ? "manifest" : "text",
          source: options.files
            ? "import fs from 'node:fs'; const input=JSON.parse(fs.readFileSync(0,'utf8')); const marker=input.inputs.value[0].value; fs.writeFileSync('left.txt','LEFT:'+marker); fs.writeFileSync('right.txt','RIGHT:'+marker); process.stdout.write(JSON.stringify({outputs:Object.fromEntries(['left','right'].map(id=>[id,[{kind:'file',relativePath:id+'.txt',name:'same.txt',mimeType:'text/plain'}]]))}));"
            : (options.source ??
              "import fs from 'node:fs'; const input=JSON.parse(fs.readFileSync(0,'utf8')); process.stdout.write(input.inputs.value[0].value.toUpperCase());"),
        },
  });
  const writer = OperationRevisionSchema.parse({
    apiVersion: 2,
    id: `writer-${id}`,
    revision: 1,
    name: "Write report",
    inputPorts: options.files
      ? [{ id: "files", valueType: "artifact", cardinality: "many" }]
      : [port],
    outputPorts: [{ id: "file", valueType: "artifact", cardinality: "one" }],
    executor: {
      kind: "script",
      language: "javascript",
      outputMode: "manifest",
      source: options.files
        ? "import fs from 'node:fs'; const input=JSON.parse(fs.readFileSync(0,'utf8')); const values=input.inputs.files; if(values.length!==2 || values[0].artifactId===values[1].artifactId) process.exit(19); const text=values.map(value=>fs.readFileSync(input.artifactFiles[value.artifactId].relativePath,'utf8')); if(!text[0].startsWith('RIGHT:') || !text[1].startsWith('LEFT:') || text[0].slice(6)!==text[1].slice(5)) process.exit(20); fs.writeFileSync('report.md',text.join('\\n'),'utf8'); process.stdout.write(JSON.stringify({outputs:{file:[{kind:'file',relativePath:'report.md',name:'report.md',mimeType:'text/markdown'}]}}));"
        : "import fs from 'node:fs'; const input=JSON.parse(fs.readFileSync(0,'utf8')); fs.writeFileSync('report.md','# '+input.inputs.value[0].value+'\\n','utf8'); process.stdout.write(JSON.stringify({outputs:{file:[{kind:'file',relativePath:'report.md',name:'report.md',mimeType:'text/markdown'}]}}));",
    },
  });
  (
    await service.saveOperation(principal, { apiVersion: 2, expectedRevision: 0, operation: first })
  )._unsafeUnwrap();
  if (options.writer)
    (
      await service.saveOperation(principal, {
        apiVersion: 2,
        expectedRevision: 0,
        operation: writer,
      })
    )._unsafeUnwrap();
  const pipeline = PipelineDefinitionSchema.parse({
    apiVersion: 2,
    id: `pipeline-${id}`,
    revision: 1,
    name: "Real v2 execution",
    graph: {
      schemaVersion: 2,
      inputs: [port],
      nodes: [
        {
          id: "first",
          operation: { operationId: first.id, revision: 1 },
          checkpoint: options.checkpoint ?? false,
        },
        ...(options.writer
          ? [{ id: "writer", operation: { operationId: writer.id, revision: 1 } }]
          : []),
      ],
      edges: [
        {
          id: "input",
          source: { kind: "input", portId: "value" },
          target: { nodeId: "first", portId: "value" },
          order: 0,
        },
        ...(options.writer
          ? options.files
            ? ["left", "right"].map((id, index) => ({
                id: `next-${id}`,
                source: { kind: "node", nodeId: "first", portId: id },
                target: { nodeId: "writer", portId: "files" },
                order: 1 - index,
              }))
            : [
                {
                  id: "next",
                  source: { kind: "node", nodeId: "first", portId: "value" },
                  target: { nodeId: "writer", portId: "value" },
                  order: 0,
                },
              ]
          : []),
      ],
      outputs: options.writer
        ? [
            {
              port: { id: "file", valueType: "artifact", cardinality: "one" },
              source: { nodeId: "writer", portId: "file" },
            },
          ]
        : [{ port, source: { nodeId: "first", portId: "value" } }],
    },
  });
  const { apiVersion, revision: _revision, id: pipelineId, ...definition } = pipeline;
  (
    await service.savePipeline(principal, {
      apiVersion,
      pipelineId,
      expectedRevision: 0,
      definition,
    })
  )._unsafeUnwrap();
  const input = RunRequestInputSchema.parse({
    apiVersion: 2,
    requestId: randomUUID(),
    pipelineId: pipeline.id,
    expectedRevision: 1,
    inputs: { value: [{ kind: "text", value: "hello 文件" }] },
    ...(options.writer
      ? { deliveryRequirements: [{ nodeId: "writer", portId: "file", minimumItems: 1 }] }
      : {}),
  });
  const receipt = (await service.submit(principal, input))._unsafeUnwrap();
  const accept = async () =>
    receipt.state === "awaiting_approval"
      ? (await service.approve(principal, receipt.approvalId))._unsafeUnwrap()
      : receipt;
  const claim = async () => {
    const accepted = await accept();
    if (accepted.state !== "accepted") throw new Error("Expected accepted receipt");
    const row = await jobs.claimJob(
      principal,
      accepted.jobId,
      "test-executor",
      options.leaseMs ?? 15_000,
    );
    if (!row) throw new Error("Expected one Job claim");

    return row;
  };
  const start = (claimed: Awaited<ReturnType<typeof claim>>) => {
    const controller = new AbortController();
    const releaseBeforeStop: Array<() => Promise<void>> = [];
    const state: { settled?: Awaited<ReturnType<typeof runner.run>> } = {};
    record("runner_started", { jobId: claimed.id, executable: process.execPath });
    const running = Promise.resolve(runner.run(claimed, controller.signal)).then((result) => {
      state.settled = result;
      record("runner_settled", {
        result: result.isOk() ? { state: result.value.state } : { error: result.error },
      });

      return result;
    });
    onTestFinished(async () => {
      const released = await Promise.allSettled(releaseBeforeStop.map((release) => release()));
      controller.abort();
      await running;
      await writeFile(
        join(directory, "runner-diagnostics.json"),
        JSON.stringify(
          {
            namespace,
            jobId: claimed.id,
            trace,
            attempts: await jobs.listAttempts(principal, claimed.id),
          },
          null,
          2,
        ),
        "utf8",
      );
      await jobs.recoverExpired(principal.workspaceId);
      const failedRelease = released.find((result) => result.status === "rejected");
      if (failedRelease?.status === "rejected") throw failedRelease.reason;
    });

    return {
      running,
      beforeStop: (release: () => Promise<void>) => releaseBeforeStop.push(release),
      assertRunning: () => {
        if (state.settled)
          throw new Error(
            `Runner ended before expected evidence: ${JSON.stringify(state.settled.isErr() ? state.settled.error : { state: state.settled.value.state })}`,
          );
      },
      record,
    };
  };

  return { principal, store, service, runner, input, receipt, accept, claim, directory, start };
};

describe("real v2 preparation, PostgreSQL, processes, and files", () => {
  beforeAll(async () => {
    const [identity] = await client`SELECT current_database() AS name`;
    expect(identity?.name).toBe("ordine_pipeline_v2_r5");
    await client.unsafe(`CREATE SCHEMA "${namespace}"`);
    const migration = await readFile(
      join(import.meta.dirname, "../../../..", "apps/create/migrations-v2/0001_execution.sql"),
      "utf8",
    );
    await client.begin(async (tx) => {
      for (const statement of migration
        .split("--> statement-breakpoint")
        .filter((value) => value.trim()))
        await tx.unsafe(statement);
    });
    await mkdir(evidenceRoot, { recursive: true });
  });
  afterAll(async () => {
    await client.end();
  });

  it("stops a real script before an unresponsive heartbeat can outlive its lease", async () => {
    const f = await fixture({
      leaseMs: 3000,
      source:
        "import fs from 'node:fs';fs.writeFileSync('started.json',JSON.stringify({pid:process.pid}));setInterval(()=>process.stdout.write('tick'),100);",
    });
    const claimed = await f.claim();
    const observed = f.start(claimed);
    const running = observed.running;
    const attempts = await until(
      () => jobs.listAttempts(f.principal, claimed.id),
      (rows) => rows.length === 1,
    );
    const marker = join(f.directory, "workspaces", claimed.id, attempts[0]!.id, "started.json");
    const started = await until(
      async () => {
        observed.assertRunning();
        const read = Result.fromThrowable(
          () => JSON.parse(readFileSync(marker, "utf8")) as { pid: number },
          () => null,
        )();

        return read.isOk() ? read.value : null;
      },
      (value) => Boolean(value?.pid),
    );
    const acquired = deferred();
    const release = deferred();
    const safety = setTimeout(() => release.resolve(), 8000);
    const lock = client.begin(async (transaction) => {
      await transaction`SELECT id FROM execution_jobs WHERE id=${claimed.id} FOR UPDATE`;
      acquired.resolve();
      await release.promise;
    });
    observed.beforeStop(async () => {
      release.resolve();
      clearTimeout(safety);
      await lock;
    });
    await acquired.promise;
    observed.record("heartbeat_lock_acquired", { pid: started!.pid });
    await new Promise<void>((resolve) => setTimeout(resolve, 4500));
    const stoppedBeforeUnlock = !processExists(started!.pid);
    observed.record("heartbeat_lock_released", { stoppedBeforeUnlock });
    release.resolve();
    clearTimeout(safety);
    await lock;
    await running;
    await jobs.recoverExpired(f.principal.workspaceId);
    const recovered = await requests.getJob(f.principal, claimed.id);
    await writeFile(
      join(f.directory, "blocked-heartbeat.json"),
      JSON.stringify({
        jobId: claimed.id,
        pid: started!.pid,
        leaseMs: 3000,
        stoppedBeforeUnlock,
        state: recovered?.state,
      }),
      "utf8",
    );
    expect(stoppedBeforeUnlock).toBe(true);
    expect(recovered?.state).toBe("interrupted");
    expect(await jobs.claimNext(f.principal.workspaceId, "replacement", 3000)).toBeNull();
    expect(await jobs.listArtifacts(f.principal, claimed.id)).toEqual([]);
  }, 60_000);

  it("runs two saved scripts and publishes the exact verified report after approval", async () => {
    const f = await fixture({ writer: true });
    expect(f.receipt.state).toBe("awaiting_approval");
    expect(await jobs.listJobs(f.principal)).toEqual([]);
    const claimed = await f.claim();
    const completed = (await f.runner.run(claimed, new AbortController().signal))._unsafeUnwrap();
    expect(completed.state).toBe("succeeded");
    const result = (await f.service.getResult(f.principal, claimed.id))._unsafeUnwrap();
    expect(result.artifacts).toHaveLength(1);
    const artifact = result.artifacts[0]!;
    const downloaded = (
      await f.store.readArtifact(f.principal, artifact.artifactId)
    )._unsafeUnwrap();
    const bytes = Buffer.from(downloaded.bytes);
    expect(bytes.toString("utf8")).toBe("# HELLO 文件\n");
    expect(artifact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(artifact.sizeBytes).toBe(bytes.byteLength);
    const attempts = await jobs.listAttempts(f.principal, claimed.id);
    expect(attempts.map((attempt) => attempt.state)).toEqual(["succeeded", "succeeded"]);
    const replay = (await f.service.submit(f.principal, f.input))._unsafeUnwrap();
    expect(replay).toMatchObject({ state: "accepted", jobId: claimed.id });
    await writeFile(
      join(f.directory, "acceptance.json"),
      JSON.stringify(
        {
          jobId: claimed.id,
          namespace,
          result,
          attempts,
          artifactPath: join(
            f.directory,
            "jobs",
            claimed.id,
            artifact.attemptId,
            artifact.artifactId,
          ),
        },
        null,
        2,
      ),
      "utf8",
    );
  }, 60_000);

  it("consumes two physical same-named files through many ports in explicit edge order", async () => {
    const f = await fixture({ writer: true, files: true });
    const claimed = await f.claim();
    expect((await f.runner.run(claimed, new AbortController().signal))._unsafeUnwrap().state).toBe(
      "succeeded",
    );
    const result = (await f.service.getResult(f.principal, claimed.id))._unsafeUnwrap();
    const file = result.artifacts.find((artifact) => artifact.nodeId === "writer")!;
    const read = (await f.store.readArtifact(f.principal, file.artifactId))._unsafeUnwrap();
    const bytes = Buffer.from(read.bytes);
    expect(bytes.toString("utf8")).toBe("RIGHT:hello 文件\nLEFT:hello 文件");
    expect(file.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    const produced = (await jobs.listArtifacts(f.principal, claimed.id)).filter(
      (artifact) => artifact.nodeId === "first",
    );
    expect(produced).toHaveLength(2);
    expect(new Set(produced.map((artifact) => artifact.artifactId)).size).toBe(2);
    expect(new Set(produced.map((artifact) => artifact.metadata.sha256)).size).toBe(2);
    await writeFile(
      join(f.directory, "two-file-acceptance.json"),
      JSON.stringify(
        { namespace, jobId: claimed.id, result, produced, content: bytes.toString("utf8") },
        null,
        2,
      ),
      "utf8",
    );
  }, 60_000);

  it("keeps nonzero and empty successful processes from producing a successful Job", async () => {
    for (const [source, exitCode] of [
      ["process.exit(7)", 7],
      ["process.stdout.write('')", 0],
    ] as const) {
      const f = await fixture({ source });
      const claimed = await f.claim();
      const completed = (await f.runner.run(claimed, new AbortController().signal))._unsafeUnwrap();
      expect(completed.state).toBe("failed");
      const events = await jobs.getEvents(f.principal, claimed.id);
      const processResult = events.find((event) => event.type === "process_result");
      expect(processResult?.payload).toMatchObject({ exitCode, stdoutBytes: 0 });
      expect(await jobs.listArtifacts(f.principal, claimed.id)).toEqual([]);
    }
  }, 60_000);

  it("keeps checkpoint acknowledgement distinct from a user pause", async () => {
    const f = await fixture({ builtin: true, checkpoint: true });
    const claimed = await f.claim();
    const { running } = f.start(claimed);
    await until(
      () => requests.getJob(f.principal, claimed.id),
      (job) => job?.state === "waiting_for_input",
    );
    (await f.service.controlJob(f.principal, claimed.id, { action: "pause" }))._unsafeUnwrap();
    const acknowledged = (
      await f.service.ackCheckpoint(f.principal, claimed.id, "first")
    )._unsafeUnwrap();
    expect(acknowledged.state).toBe("paused");
    expect(await jobs.listAttempts(f.principal, claimed.id)).toEqual([]);
    (await f.service.controlJob(f.principal, claimed.id, { action: "resume" }))._unsafeUnwrap();
    expect((await running)._unsafeUnwrap().state).toBe("succeeded");
  }, 30_000);

  it("converges a real running process after durable cancellation", async () => {
    const f = await fixture({
      source:
        "import fs from 'node:fs'; fs.writeFileSync('started.json',JSON.stringify({pid:process.pid})); setInterval(()=>process.stdout.write('tick'),100);",
    });
    const claimed = await f.claim();
    const observed = f.start(claimed);
    const running = observed.running;
    const attempts = await until(
      () => jobs.listAttempts(f.principal, claimed.id),
      (rows) => rows.length === 1,
    );
    const marker = join(f.directory, "workspaces", claimed.id, attempts[0]!.id, "started.json");
    const markerResult = await until(
      async () => {
        observed.assertRunning();
        const content = Result.fromThrowable(
          () => JSON.parse(readFileSync(marker, "utf8")) as { pid: number },
          () => null,
        )();

        return content.isOk() ? content.value : null;
      },
      (value) => Boolean(value?.pid),
    );
    expect(processExists(markerResult!.pid)).toBe(true);
    const receipt = (
      await f.service.controlJob(f.principal, claimed.id, { action: "cancel" })
    )._unsafeUnwrap();
    expect(receipt.state).toBe("cancelling");
    expect((await running)._unsafeUnwrap().state).toBe("cancelled");
    expect(processExists(markerResult!.pid)).toBe(false);
  }, 60_000);
});
