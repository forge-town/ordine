import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ResultAsync } from "neverthrow";
import {
  ExecutionApprovalSchema,
  ExecutionArtifactSchema,
  ExecutionEventSchema,
  ExecutionInputAssetSchema,
  ExecutionJobResultSchema,
  ExecutionJobSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  RunRequestInputSchema,
  RunRequestReceiptSchema,
} from "@repo/schemas";
import { createExecutionRunRequestsDao, hashExecutionJson, hashPreparedRun } from "@repo/models";
import { startExecutionServer } from "../src/executionServer";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const outputDirectory =
  process.env.ORDINE_R12_EVIDENCE_DIRECTORY ??
  join(workspace, "../../outputs/pipeline-v2-implementation");
const databaseUrl =
  process.env.ORDINE_R12_DATABASE_URL ??
  "postgres://postgres@127.0.0.1:36435/ordine_pipeline_v2_r5";
const target = new URL(databaseUrl);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.port, "36435");
assert.equal(target.pathname, "/ordine_pipeline_v2_r5");
const namespace = `r12_t1_${randomUUID().replaceAll("-", "")}`;
const principal = { subjectId: "r12-owner", workspaceId: "r12-workspace" };
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const evidence = async (name: string, value: unknown) =>
  writeFile(join(outputDirectory, `r12-t1-${name}.json`), JSON.stringify(value, null, 2), {
    encoding: "utf8",
  });
const pause = (ms = 300) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const state: {
  server?: Extract<Awaited<ReturnType<typeof startExecutionServer>>, { value: unknown }>["value"];
  client?: Client;
  transport?: StdioClientTransport;
  privateDirectory?: string;
  dataDirectory?: string;
  appToken?: string;
  agentToken?: string;
  baseUrl?: string;
} = {};

const request = async (
  path: string,
  options: { method?: string; body?: unknown; agent?: boolean; expectStatus?: number } = {},
) => {
  assert(state.baseUrl && state.appToken && state.agentToken);
  const response = await fetch(`${state.baseUrl}/api/v2${path}`, {
    method: options.method ?? "GET",
    headers: {
      "X-Ordine-Api-Version": "2",
      ...(options.agent
        ? { Authorization: `Bearer ${state.agentToken}` }
        : { "X-Desktop-Token": state.appToken }),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(60_000),
  });
  const body: unknown = await response.json();
  assert.equal(response.status, options.expectStatus ?? 200, `${path}: ${JSON.stringify(body)}`);

  return body;
};
const call = async (name: string, args: Record<string, unknown> = {}) => {
  assert(state.client);
  const result = await state.client.callTool(
    { name: `ordine.v2.${name}`, arguments: args },
    undefined,
    { timeout: 90_000 },
  );
  assert(!result.isError, `${name}: ${JSON.stringify(result.content)}`);
  if (result.structuredContent) return result.structuredContent as Record<string, unknown>;
  const parts = result.content as { type: string; text?: string }[];
  const text = parts.find((part) => part.type === "text")?.text;
  assert(text, `${name} returned no JSON content`);

  return JSON.parse(text) as Record<string, unknown>;
};
const receipt = (value: Record<string, unknown>) => {
  const { nextStep: _nextStep, ...content } = value;

  return RunRequestReceiptSchema.parse(content);
};
const port = (
  id: string,
  valueType: "text" | "json" | "artifact",
  jsonSchema?: Record<string, unknown>,
) => ({
  id,
  valueType,
  cardinality: "one" as const,
  required: true,
  allowEmpty: false,
  ...(jsonSchema ? { jsonSchema } : {}),
});
const notes = `# 检索增强生成的小规模实验记录

本笔记记录一个自建的教学实验，不代表任何真实论文的外部结论。

## 研究问题
在固定知识库和同一组40道课程问答题上，比较纯生成与检索增强生成的回答可核验性。

## 方法与结果
纯生成基线有22道回答与课程材料一致；加入检索后有31道回答与材料一致。两组都使用同一评分规则，评分者检查回答是否能被材料直接支持。
检索版本会附上材料段落编号，但仍有9道回答未通过核验。实验没有做统计显著性检验，也没有测量响应时间。

## 局限与下一步
题目数量有限、来自单门课程，可能存在题目选择偏差。下一步应该扩大样本、盲评，并记录检索失配和无依据推断两类错误。
`;
const summarySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    researchQuestion: { type: "string", minLength: 1 },
    findings: { type: "array", minItems: 2, items: { type: "string", minLength: 1 } },
    limitations: { type: "array", minItems: 2, items: { type: "string", minLength: 1 } },
    evidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        questions: { type: "integer" },
        baselineSupported: { type: "integer" },
        retrievalSupported: { type: "integer" },
      },
      required: ["questions", "baselineSupported", "retrievalSupported"],
    },
  },
  required: ["title", "researchQuestion", "findings", "limitations", "evidence"],
};
const writerSource = `import fs from "node:fs";
import assert from "node:assert/strict";
const input=JSON.parse(fs.readFileSync(0,"utf8"));
const result=input.inputs.summary[0];
assert.equal(result.kind,"json");
const data=result.value;
assert.equal(typeof data.title,"string");assert(data.title.trim());
assert.equal(typeof data.researchQuestion,"string");assert(data.researchQuestion.trim());
assert(Array.isArray(data.findings)&&data.findings.length>=2&&data.findings.every(x=>typeof x==="string"&&x.trim()));
assert(Array.isArray(data.limitations)&&data.limitations.length>=2&&data.limitations.every(x=>typeof x==="string"&&x.trim()));
assert.deepEqual(data.evidence,{questions:40,baselineSupported:22,retrievalSupported:31});
const report="# "+data.title+"\\n\\n## 研究问题\\n"+data.researchQuestion+"\\n\\n## 主要发现\\n"+data.findings.map(x=>"- "+x).join("\\n")+"\\n\\n## 局限\\n"+data.limitations.map(x=>"- "+x).join("\\n")+"\\n\\n## 可核验数据\\n题目：40；基线支持：22；检索支持：31。\\n";
fs.writeFileSync("research-report.md",report,"utf8");
process.stdout.write(JSON.stringify({outputs:{report:[{kind:"file",relativePath:"research-report.md",name:"research-report.md",mimeType:"text/markdown"}]}}));`;

const run = async () => {
  await mkdir(outputDirectory, { recursive: true });
  state.privateDirectory = await mkdtemp(join(tmpdir(), "ordine-r12-private-"));
  state.dataDirectory = join(state.privateDirectory, "data");
  state.appToken = randomBytes(32).toString("hex");
  const appTokenFile = join(state.privateDirectory, "app-token");
  await writeFile(appTokenFile, state.appToken, { encoding: "utf8", mode: 0o600, flag: "wx" });
  const instanceId = randomUUID();
  const javascriptPath = await realpath(
    process.env.ORDINE_R12_NODE_PATH ?? "C:/nvm4w/nodejs/node.exe",
  );
  const codexPath = await realpath(
    process.env.ORDINE_R12_CODEX_PATH ??
      "C:/Users/woodfish/AppData/Local/OpenAI/Codex/bin/8e5b6932251c2c1c/codex.exe",
  );
  const started = await startExecutionServer({
    databaseUrl,
    schema: namespace,
    initialize: true,
    dataDirectory: state.dataDirectory,
    appToken: state.appToken,
    subjectId: principal.subjectId,
    workspaceId: principal.workspaceId,
    instanceId,
    port: 0,
    desktop: true,
    migrationPath: join(workspace, "apps/create/migrations-v2/0001_execution.sql"),
    javascriptPath,
    allowedOrigins: ["http://localhost:9430", "http://127.0.0.1:9430"],
    stdinControl: false,
    buildRevision: "pipeline-v2-r12-acceptance",
  });
  assert(started.isOk(), started.isErr() ? started.error : "startup failed");
  state.server = started.value;
  assert(started.value.port);
  state.baseUrl = `http://127.0.0.1:${started.value.port}`;
  const agentTokenFile = join(state.dataDirectory, "agent-token");
  state.agentToken = (await readFile(agentTokenFile, "utf8")).trim();
  assert.notEqual(state.appToken, state.agentToken);
  await evidence("instance", {
    baseUrl: state.baseUrl,
    instanceId,
    namespace,
    mode: "desktop",
    appCredentialTransport: "X-Desktop-Token",
    agentCredentialTransport: "Bearer",
    dataDirectory: state.dataDirectory,
    agentTokenFile,
    appTokenFile,
    pid: process.pid,
    database: { host: target.hostname, port: target.port, name: target.pathname.slice(1) },
    javascriptPath,
    codexPath,
    codexSha256: sha(await readFile(codexPath)),
  });
  console.log(`R12_INSTANCE ${JSON.stringify({ baseUrl: state.baseUrl, instanceId, namespace })}`);

  const runtime = await request("/runtime-configs/r12-codex", {
    method: "PUT",
    body: {
      apiVersion: 2,
      expectedRevision: 0,
      config: {
        id: "r12-codex",
        name: "R12 frozen Codex",
        type: "codex",
        connection: {
          mode: "local",
          path: codexPath,
          version: "0.153.4",
          models: [
            {
              id: "gpt-5.6-luna",
              displayName: "GPT-5.6 Luna",
              reasoningEfforts: [{ value: "low" }],
              speeds: [{ value: "standard" }],
              defaultReasoningEffort: "low",
              defaultSpeed: "standard",
            },
          ],
          modelsSource: "live",
        },
      },
    },
  });
  await evidence("runtime-config", runtime);
  const environment: Record<string, string> = {};
  for (const key of [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "USERPROFILE",
    "HOME",
    "TEMP",
    "TMP",
    "APPDATA",
    "LOCALAPPDATA",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
  ])
    if (process.env[key]) environment[key] = process.env[key]!;
  Object.assign(environment, {
    ORDINE_API_URL: state.baseUrl,
    ORDINE_AUTH_MODE: "bearer",
    ORDINE_AGENT_API_TOKEN_FILE: agentTokenFile,
  });
  state.transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(workspace, "apps/cli/src/mcp-sidecar.ts"), "--allow-write"],
    env: environment,
    stderr: "pipe",
  });
  state.client = new Client({ name: "ordine-v2-r12-acceptance", version: "1.0.0" });
  await state.client.connect(state.transport);
  const tools = await state.client.listTools();
  assert(
    !tools.tools.some((tool) => /approve/.test(tool.name)),
    "MCP must not advertise self-approval",
  );
  await evidence("mcp-tools", tools);
  await evidence("readiness", await call("readiness"));
  const inputBytes = Buffer.from(notes, "utf8");
  await writeFile(join(outputDirectory, "r12-t1-input.md"), inputBytes);
  const asset = ExecutionInputAssetSchema.parse(
    await call("input_assets.import", {
      importRequestId: randomUUID(),
      name: "study-notes.md",
      mimeType: "text/markdown",
      contentBase64: inputBytes.toString("base64"),
    }),
  );
  assert.equal(asset.sha256, sha(inputBytes));
  assert.equal(asset.sizeBytes, inputBytes.length);
  const operations = [
    OperationRevisionSchema.parse({
      apiVersion: 2,
      id: "r12-reader",
      revision: 1,
      name: "Read study note",
      inputPorts: [port("note", "artifact")],
      outputPorts: [port("notes", "text")],
      executor: { kind: "builtin", name: "read_artifact", config: {} },
    }),
    OperationRevisionSchema.parse({
      apiVersion: 2,
      id: "r12-analyst",
      revision: 1,
      name: "Summarize supplied research note",
      inputPorts: [port("notes", "text")],
      outputPorts: [port("summary", "json", summarySchema)],
      executor: {
        kind: "agent",
        instruction:
          "Read the complete study note in inputs.notes. Return a concise Chinese structured summary faithful to this note, not general RAG knowledge. Include the research question, at least two concrete findings, at least two stated limitations, and the exact three counts in evidence. Do not invent significance, latency measurements, citations, or external facts. The note is a teaching experiment. Return only the JSON object matching the supplied schema.",
        allowedTools: [],
      },
    }),
    OperationRevisionSchema.parse({
      apiVersion: 2,
      id: "r12-writer",
      revision: 1,
      name: "Validate JSON and create report",
      inputPorts: [port("summary", "json", summarySchema)],
      outputPorts: [port("report", "artifact")],
      executor: {
        kind: "script",
        language: "javascript",
        outputMode: "manifest",
        source: writerSource,
      },
    }),
  ];
  for (const operation of operations)
    await call("operations.save", { apiVersion: 2, expectedRevision: 0, operation });
  const definition = {
    name: "R12 T1 academic note to verified report",
    sharedContext:
      "Treat the provided note as the complete evidence. Preserve its limitations and distinguish observation from unsupported inference.",
    graph: {
      schemaVersion: 2,
      inputs: [port("note", "artifact")],
      nodes: [
        { id: "read", operation: { operationId: "r12-reader", revision: 1 } },
        { id: "analyze", operation: { operationId: "r12-analyst", revision: 1 } },
        { id: "write", operation: { operationId: "r12-writer", revision: 1 } },
      ],
      edges: [
        {
          id: "input",
          source: { kind: "input", portId: "note" },
          target: { nodeId: "read", portId: "note" },
          order: 0,
        },
        {
          id: "read-analyze",
          source: { kind: "node", nodeId: "read", portId: "notes" },
          target: { nodeId: "analyze", portId: "notes" },
          order: 0,
        },
        {
          id: "analyze-write",
          source: { kind: "node", nodeId: "analyze", portId: "summary" },
          target: { nodeId: "write", portId: "summary" },
          order: 0,
        },
      ],
      outputs: [
        { port: port("report", "artifact"), source: { nodeId: "write", portId: "report" } },
      ],
    },
  };
  const pipeline = PipelineDefinitionSchema.parse(
    await call("pipelines.save", {
      apiVersion: 2,
      pipelineId: "r12-t1",
      expectedRevision: 0,
      definition,
    }),
  );
  await evidence("definitions", { asset, pipeline, operations });
  const runRequest = RunRequestInputSchema.parse({
    apiVersion: 2,
    requestId: randomUUID(),
    pipelineId: pipeline.id,
    expectedRevision: pipeline.revision,
    inputs: { note: [{ kind: "artifact", artifactId: asset.artifactId }] },
    executionOverrides: {
      runtimeConfigId: "r12-codex",
      model: "gpt-5.6-luna",
      reasoningEffort: "low",
      speed: "standard",
      firstOutputTimeoutMs: 120_000,
      inactivityTimeoutMs: 120_000,
      activeRunTimeoutMs: 600_000,
    },
    deliveryRequirements: [{ nodeId: "write", portId: "report", minimumItems: 1 }],
  });
  await evidence("request", runRequest);
  if (process.argv.includes("--prepare-only")) {
    console.log("R12_T1_PREPARED Saved definitions and input; no Job submitted.");

    return;
  }
  const pending = receipt(await call("run_requests.submit", runRequest));
  assert.equal(pending.state, "awaiting_approval");
  assert(pending.state === "awaiting_approval");
  const jobsBefore = await call("jobs.list");
  assert.deepEqual(jobsBefore, []);
  const denied = await request(`/approvals/${pending.approvalId}/approve`, {
    method: "POST",
    agent: true,
    body: {},
    expectStatus: 403,
  });
  const approval = ExecutionApprovalSchema.parse(await request(`/approvals/${pending.approvalId}`));
  assert.equal(hashPreparedRun(approval.prepared), approval.prepared.contentHash);
  const accepted = RunRequestReceiptSchema.parse(
    await request(`/approvals/${pending.approvalId}/approve`, { method: "POST", body: {} }),
  );
  assert(accepted.state === "accepted");
  const approvedAgain = RunRequestReceiptSchema.parse(
    await request(`/approvals/${pending.approvalId}/approve`, { method: "POST", body: {} }),
  );
  assert(approvedAgain.state === "accepted");
  assert.equal(approvedAgain.jobId, accepted.jobId);
  const replay = receipt(await call("run_requests.submit", runRequest));
  assert(replay.state === "accepted");
  assert.equal(replay.jobId, accepted.jobId);
  assert.equal(((await request("/jobs")) as unknown[]).length, 1);
  await evidence("approval", {
    pending,
    jobsBefore,
    denied,
    approval,
    accepted,
    approvedAgain,
    replay,
  });
  console.log(
    `R12_T1_ACCEPTED ${JSON.stringify({ requestId: runRequest.requestId, jobId: accepted.jobId, preparedHash: approval.prepared.contentHash })}`,
  );
  const deadline = Date.now() + 600_000;
  const progress = { last: "" };
  for (;;) {
    const job = ExecutionJobSchema.parse(await call("jobs.get", { jobId: accepted.jobId }));
    if (job.state !== progress.last) {
      progress.last = job.state;
      console.log(`R12_T1_JOB ${job.state}`);
    }
    if (
      ["succeeded", "partially_succeeded", "failed", "cancelled", "timed_out"].includes(job.state)
    ) {
      await evidence("job", job);
      break;
    }
    assert(Date.now() < deadline, "Timed out waiting for T1 Job completion");
    await pause(800);
  }
  const result = ExecutionJobResultSchema.parse(
    await call("jobs.result", { jobId: accepted.jobId }),
  );
  const events = ExecutionEventSchema.array().parse(
    await call("jobs.events", { jobId: accepted.jobId, afterSequence: 0, limit: 1000 }),
  );
  assert(state.server.application);
  const attempts = await state.server.application.jobs.listAttempts(principal, accepted.jobId);
  const storedRequest = await createExecutionRunRequestsDao(
    state.server.application.database.connection,
  ).findByRequestId(principal, runRequest.requestId);
  await evidence("persisted", { storedRequest, attempts, events, result });
  assert.equal(
    result.state,
    "succeeded",
    `T1 did not succeed: ${JSON.stringify(events.filter((event) => /fail|error/.test(event.type)))}`,
  );
  assert.equal(attempts.length, 3);
  assert(attempts.every((attempt) => attempt.state === "succeeded"));
  const analyst = attempts.find((attempt) => attempt.nodeId === "analyze");
  assert(analyst && analyst.agentRunId === analyst.id);
  assert.equal(storedRequest?.inputHash, hashExecutionJson(runRequest));
  assert(
    events.some(
      (event) =>
        event.type === "runtime_event" &&
        event.nodeId === "analyze" &&
        event.attemptId === analyst.id &&
        event.payload.type === "session",
    ),
  );
  assert(events.some((event) => event.type === "runtime_event" && event.payload.type === "usage"));
  assert(
    events.some(
      (event) =>
        event.type === "runtime_event" &&
        event.payload.type === "terminal" &&
        event.payload.status === "completed",
    ),
  );
  assert.equal(result.artifacts.length, 1);
  const artifact = ExecutionArtifactSchema.parse(
    await call("artifacts.get", { id: result.artifacts[0]!.artifactId }),
  );
  const content = await call("artifacts.content", {
    id: artifact.artifactId,
    offset: 0,
    length: 1024 * 1024,
  });
  assert.equal(typeof content.contentBase64, "string");
  const report = Buffer.from(content.contentBase64 as string, "base64");
  assert.equal(report.byteLength, artifact.sizeBytes);
  assert.equal(sha(report), artifact.sha256);
  assert.equal(artifact.jobId, accepted.jobId);
  assert.equal(artifact.nodeId, "write");
  assert(report.toString("utf8").includes("## 主要发现"));
  assert(report.toString("utf8").includes("## 局限"));
  await writeFile(join(outputDirectory, "r12-t1-report.md"), report);
  await evidence("artifact", {
    metadata: artifact,
    fetchedBytes: report.byteLength,
    computedSha256: sha(report),
    contentVerified: true,
    sourceInputHash: asset.sha256,
    requestInputHash: storedRequest?.inputHash,
    preparedHash: approval.prepared.contentHash,
    modelCompleted: true,
    jobSucceeded: true,
    nodeCount: attempts.length,
  });
  console.log(
    `R12_T1_SUCCEEDED ${JSON.stringify({ requestId: runRequest.requestId, jobId: accepted.jobId, artifactId: artifact.artifactId, sha256: artifact.sha256, bytes: artifact.sizeBytes })}`,
  );
};

const outcome = await ResultAsync.fromPromise(run(), (error) =>
  error instanceof Error ? error.message : String(error),
);
if (outcome.isErr()) {
  await evidence("failure", { message: outcome.error });
  console.error(`R12_FAILED ${outcome.error}`);
  process.exitCode = 1;
}
await state.client?.close();
await state.transport?.close();
if (process.argv.includes("--keep") && outcome.isOk()) {
  console.log(
    "R12_KEEP_SERVER The verified server remains available until App-authorized shutdown.",
  );
  while (state.server?.application?.dispatcher.isAccepting()) await pause(1000);
} else if (state.server && "shutdown" in state.server) state.server.shutdown();
if (state.privateDirectory)
  await ResultAsync.fromPromise(unlink(join(state.privateDirectory, "app-token")), () => undefined);
if (state.dataDirectory)
  await ResultAsync.fromPromise(unlink(join(state.dataDirectory, "agent-token")), () => undefined);
