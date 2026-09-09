import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ResultAsync } from "neverthrow";
import {
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  ExecutionJobResultSchema,
  ExecutionEventSchema,
  RuntimeNodeSchema,
} from "@repo/schemas";
import {
  ExecutionActorLimitsSchema,
  runNativeProcess,
  verifyPreparedExecutable,
  type ExecutionActorContext,
} from "@repo/services/execution";
import {
  cleanupCodexCredentials,
  inspectCodexCredentialRef,
  prepareCodexHome,
} from "../../../packages/services/src/executionPrompt/codexHome";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const outputDirectory =
  process.env.ORDINE_R12_EVIDENCE_DIRECTORY ??
  join(workspace, "../../outputs/pipeline-v2-implementation");
const instance = JSON.parse(
  await readFile(join(outputDirectory, "r12-t1-instance.json"), "utf8"),
) as {
  baseUrl: string;
  codexPath: string;
  namespace: string;
  appTokenFile: string;
  agentTokenFile: string;
};
assert(new URL(instance.baseUrl).hostname === "127.0.0.1");
const appToken = (await readFile(instance.appTokenFile, "utf8")).trim();
const agentToken = (await readFile(instance.agentTokenFile, "utf8")).trim();
assert.notEqual(appToken, agentToken);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const evidence = (name: string, value: unknown) =>
  writeFile(
    join(outputDirectory, `r12-t1-external-${name}.json`),
    JSON.stringify(value, null, 2),
    "utf8",
  );
const privateDirectory = await mkdtemp(join(tmpdir(), "ordine-r12-external-"));
const cwd = join(privateDirectory, "work");
const home = join(privateDirectory, "codex-home");
const control = new AbortController();
const previousRequest = await ResultAsync.fromPromise(
  readFile(join(outputDirectory, "r12-t1-external-request.json"), "utf8"),
  () => undefined,
);
const previousId = previousRequest.isOk()
  ? RunRequestInputSchema.parse(JSON.parse(previousRequest.value)).requestId
  : undefined;
const state = {
  finished: false,
  approved: false,
  jobId: "",
  requestId: previousId ?? randomUUID(),
};
const client = new Client({ name: "ordine-v2-r12-controller", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(workspace, "apps/cli/src/mcp-sidecar.ts"), "--allow-write"],
  env: {
    PATH: process.env.PATH ?? "",
    SystemRoot: process.env.SystemRoot ?? "C:/Windows",
    USERPROFILE: process.env.USERPROFILE ?? "",
    TEMP: process.env.TEMP ?? tmpdir(),
    TMP: process.env.TMP ?? tmpdir(),
    ORDINE_API_URL: instance.baseUrl,
    ORDINE_AUTH_MODE: "bearer",
    ORDINE_AGENT_API_TOKEN_FILE: instance.agentTokenFile,
  },
  stderr: "pipe",
});
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name: `ordine.v2.${name}`, arguments: args }, undefined, {
    timeout: 90_000,
  });
  assert(!result.isError, `${name}: ${JSON.stringify(result.content)}`);
  if (result.structuredContent) return result.structuredContent as Record<string, unknown>;
  const text = (result.content as { type: string; text?: string }[]).find(
    (item) => item.type === "text",
  )?.text;
  assert(text);

  return JSON.parse(text) as Record<string, unknown>;
};
const http = async (path: string, approve = false) => {
  const response = await fetch(`${instance.baseUrl}/api/v2${path}`, {
    method: approve ? "POST" : "GET",
    headers: {
      "X-Ordine-Api-Version": "2",
      ...(approve
        ? { "X-Desktop-Token": appToken, "Content-Type": "application/json" }
        : { Authorization: `Bearer ${agentToken}` }),
    },
    body: approve ? "{}" : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const body: unknown = await response.json();

  return { status: response.status, body };
};
const port = (id: string, valueType: "text" | "artifact") => ({
  id,
  valueType,
  cardinality: "one",
  required: true,
  allowEmpty: false,
});
const run = async () => {
  const fullT1 = process.argv.includes("--t1");
  await mkdir(cwd, { recursive: true, mode: 0o700 });
  for (const name of ["tmp", "appdata"]) await mkdir(join(cwd, name), { mode: 0o700 });
  await client.connect(transport);
  const operations = [
    OperationRevisionSchema.parse({
      apiVersion: 2,
      id: "r12-t0-upper",
      revision: 1,
      name: "Uppercase text",
      inputPorts: [port("text", "text")],
      outputPorts: [port("text", "text")],
      executor: {
        kind: "script",
        language: "javascript",
        outputMode: "text",
        source:
          'import fs from "node:fs";const x=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(x.inputs.text[0].value.toUpperCase());',
      },
    }),
    OperationRevisionSchema.parse({
      apiVersion: 2,
      id: "r12-t0-write",
      revision: 1,
      name: "Write external caller report",
      inputPorts: [port("text", "text")],
      outputPorts: [port("report", "artifact")],
      executor: {
        kind: "script",
        language: "javascript",
        outputMode: "manifest",
        source:
          'import fs from "node:fs";const x=JSON.parse(fs.readFileSync(0,"utf8"));fs.writeFileSync("external-report.md","# "+x.inputs.text[0].value+"\\n","utf8");process.stdout.write(JSON.stringify({outputs:{report:[{kind:"file",relativePath:"external-report.md",name:"external-report.md",mimeType:"text/markdown"}]}}));',
      },
    }),
  ];
  const savedOperations = OperationRevisionSchema.array().parse(await call("operations.list"));
  for (const operation of operations) {
    const existing = savedOperations.find((candidate) => candidate.id === operation.id);
    if (existing) assert.deepEqual(existing, operation);
    else await call("operations.save", { apiVersion: 2, expectedRevision: 0, operation });
  }
  const savedPipelines = PipelineDefinitionSchema.array().parse(await call("pipelines.list"));
  const existingPipeline = savedPipelines.find((candidate) => candidate.id === "r12-external-t0");
  const pipeline = PipelineDefinitionSchema.parse(
    existingPipeline ??
      (await call("pipelines.save", {
        apiVersion: 2,
        pipelineId: "r12-external-t0",
        expectedRevision: 0,
        definition: {
          name: "R12 external Codex MCP T0",
          graph: {
            schemaVersion: 2,
            inputs: [port("text", "text")],
            nodes: [
              { id: "upper", operation: { operationId: "r12-t0-upper", revision: 1 } },
              { id: "write", operation: { operationId: "r12-t0-write", revision: 1 } },
            ],
            edges: [
              {
                id: "input",
                source: { kind: "input", portId: "text" },
                target: { nodeId: "upper", portId: "text" },
                order: 0,
              },
              {
                id: "next",
                source: { kind: "node", nodeId: "upper", portId: "text" },
                target: { nodeId: "write", portId: "text" },
                order: 0,
              },
            ],
            outputs: [
              { port: port("report", "artifact"), source: { nodeId: "write", portId: "report" } },
            ],
          },
        },
      })),
  );
  const defaultRequest = RunRequestInputSchema.parse({
    apiVersion: 2,
    requestId: state.requestId,
    pipelineId: pipeline.id,
    expectedRevision: pipeline.revision,
    inputs: { text: [{ kind: "text", value: "external Codex MCP acceptance" }] },
    executionOverrides: {
      firstOutputTimeoutMs: 120_000,
      inactivityTimeoutMs: 120_000,
      activeRunTimeoutMs: 300_000,
    },
    deliveryRequirements: [{ nodeId: "write", portId: "report", minimumItems: 1 }],
  });
  const request = fullT1
    ? RunRequestInputSchema.parse({
        ...JSON.parse(await readFile(join(outputDirectory, "r12-t1-request.json"), "utf8")),
        requestId: state.requestId,
      })
    : defaultRequest;
  await evidence("request", request);
  const approvedProfile = await inspectCodexCredentialRef();
  const { environment, redact } = await prepareCodexHome(home, approvedProfile);
  assert(
    !Object.values(environment).some((value) => value.includes(appToken)),
    "App token must never enter external Codex environment",
  );
  const bunPath = await realpath(process.execPath);
  const baseConfig = await readFile(join(home, "config.toml"), "utf8");
  const callerTools = [
    "pipelines.get",
    "run_requests.submit",
    "run_requests.get",
    "jobs.get",
    "jobs.result",
    "artifacts.get",
    "artifacts.content",
  ].map((name) => `ordine.v2.${name}`);
  const mcpConfig = `\n[mcp_servers.ordine]\ncommand=${JSON.stringify(bunPath)}\nargs=${JSON.stringify([join(workspace, "apps/cli/src/mcp-sidecar.ts"), "--allow-write"])}\nenabled_tools=${JSON.stringify(callerTools)}\nstartup_timeout_sec=60\ntool_timeout_sec=90\n[mcp_servers.ordine.env]\nORDINE_API_URL=${JSON.stringify(instance.baseUrl)}\nORDINE_AUTH_MODE="bearer"\nORDINE_AGENT_API_TOKEN_FILE=${JSON.stringify(instance.agentTokenFile)}\n`;
  // The user authorized this exact submit tool; ORDINE's separate App approval is still mandatory.
  const clientToolGrant =
    '\n[mcp_servers.ordine.tools."ordine.v2.run_requests.submit"]\napproval_mode="approve"\n';
  await writeFile(join(home, "config.toml"), baseConfig + mcpConfig + clientToolGrant, {
    encoding: "utf8",
    mode: 0o600,
  });
  const finalSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      requestId: { type: "string" },
      jobId: { type: "string" },
      artifactId: { type: "string" },
      sha256: { type: "string" },
      contentBase64: { type: "string" },
    },
    required: ["requestId", "jobId", "artifactId", "sha256", "contentBase64"],
  };
  const schemaPath = join(cwd, "caller-result-schema.json");
  await writeFile(schemaPath, JSON.stringify(finalSchema), "utf8");
  const expectation = fullT1
    ? "The saved pipeline reads a Markdown input artifact, uses an internal Codex step, validates the structured findings, and writes a research summary report."
    : "The expected report text is the input transformed to uppercase with a Markdown heading.";
  const prompt = `Use the configured ORDINE MCP server to execute the already-saved pipeline below. Do not save or modify definitions. Submit exactly this RunRequest once, preserving its requestId. You have only the Agent credential and must never approve your own request. A separate user-authorized application test controller is watching for pending approval and will approve it. If awaiting approval, keep querying the SAME requestId until accepted; do not create another request. Then query that Job until succeeded, inspect jobs.result, fetch artifact metadata and its COMPLETE artifacts.content byte range. Return the real requestId/jobId/artifactId/sha256/contentBase64 using the provided output schema. No guessed values; a Job ID or model completion alone is not delivery. ${expectation}\n\nRunRequest: ${JSON.stringify(request)}`;
  const attemptId = randomUUID();
  const context: ExecutionActorContext = {
    jobId: state.requestId,
    attemptId,
    node: RuntimeNodeSchema.parse({
      id: "external-caller",
      operation: { operationId: "external-caller", revision: 1 },
    }),
    operation: OperationRevisionSchema.parse({
      apiVersion: 2,
      id: "external-caller",
      revision: 1,
      name: "Acceptance caller lifecycle",
      inputPorts: [],
      outputPorts: [{ id: "result", valueType: "text", cardinality: "one" }],
      executor: { kind: "agent", instruction: prompt },
    }),
    resolved: {
      executorKind: "agent",
      runtimeConfigId: "external-codex",
      agent: "codex",
      executablePath: instance.codexPath,
      executableSha256: sha(await readFile(instance.codexPath)),
      model: "gpt-5.6-luna",
      reasoningEffort: "low",
      speed: "standard",
      timeouts: {
        firstOutputTimeoutMs: 120_000,
        inactivityTimeoutMs: 120_000,
        activeRunTimeoutMs: 600_000,
        waitingTimeoutMs: 600_000,
      },
      origins: {},
    },
    inputs: {},
    iteration: 1,
    attemptNumber: 1,
    sharedContext: "",
    signal: control.signal,
    artifactContext: {
      lease: {
        jobId: state.requestId,
        subjectId: "external-harness",
        workspaceId: "external-harness",
        executorId: "caller",
        generation: 1,
      },
      nodeId: "external-caller",
      attemptId,
      signal: control.signal,
    },
  };
  // Context above supplies only native process lifecycle fields; no fake ORM Job is created.
  await verifyPreparedExecutable(context);
  const disabled = [
    "apps",
    "plugins",
    "multi_agent",
    "multi_agent_v2",
    "shell_tool",
    "unified_exec",
    "search_tool",
    "standalone_web_search",
    "browser_use",
    "browser_use_external",
    "browser_use_full_cdp_access",
    "computer_use",
    "image_generation",
    "in_app_browser",
    "view_image",
    "workspace_dependencies",
    "hooks",
    "memories",
    "goals",
    "sleep_tool",
    "skill_search",
    "skill_mcp_dependency_install",
  ];
  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--strict-config",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    "--model",
    "gpt-5.6-luna",
    "-c",
    'model_reasoning_effort="low"',
    "-c",
    'service_tier="default"',
    "-c",
    "features.skip_host_skill_discovery=true",
    "--output-schema",
    schemaPath,
    ...disabled.flatMap((name) => ["--disable", name]),
    "-",
  ];
  console.log(
    `R12_EXTERNAL_START ${JSON.stringify({ requestId: state.requestId, pipelineId: request.pipelineId })}`,
  );
  const execution = ResultAsync.fromPromise(
    runNativeProcess({
      context,
      workspace: cwd,
      stdin: Buffer.from(prompt),
      arguments: args,
      environment,
      limits: ExecutionActorLimitsSchema.parse({
        maxStdoutBytes: 16 * 1024 * 1024,
        maxOutputBytes: 17 * 1024 * 1024,
        maxDurationMs: 600_000,
      }),
    }),
    (error) => (error instanceof Error ? error.message : String(error)),
  )
    .map((outcome) => {
      state.finished = true;

      return outcome;
    })
    .mapErr((error) => {
      state.finished = true;

      return error;
    });
  const deadline = Date.now() + 600_000;
  for (;;) {
    const recovered = await http(`/run-requests/${state.requestId}`);
    if (recovered.status === 200) {
      const receipt = RunRequestReceiptSchema.parse(recovered.body);
      if (receipt.state === "awaiting_approval" && !state.approved) {
        const pendingJobs = await http("/jobs");
        assert(pendingJobs.status === 200 && Array.isArray(pendingJobs.body));
        const approval = await http(`/approvals/${receipt.approvalId}/approve`, true);
        assert.equal(approval.status, 200, JSON.stringify(approval.body));
        const accepted = RunRequestReceiptSchema.parse(approval.body);
        assert(accepted.state === "accepted");
        state.jobId = accepted.jobId;
        state.approved = true;
        await evidence("approval", {
          pending: receipt,
          pendingJobs: pendingJobs.body,
          controllerAudience: "app",
          accepted,
        });
        console.log(
          `R12_EXTERNAL_APPROVED ${JSON.stringify({ requestId: state.requestId, jobId: state.jobId })}`,
        );
      }
    } else assert.equal(recovered.status, 404, JSON.stringify(recovered.body));
    if (state.finished) break;
    if (Date.now() >= deadline) {
      control.abort();
      break;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }
  const completed = await execution;
  assert(completed.isOk(), completed.isErr() ? completed.error : "Native caller failed");
  const native = completed.value;
  const stdout = redact(native.stdout.toString("utf8"));
  const stderr = redact(native.report.stderr);
  await writeFile(join(outputDirectory, "r12-t1-external-codex.jsonl"), stdout, "utf8");
  await evidence("process", {
    ...native.report,
    stderr,
    error: native.error,
    appTokenShared: false,
    onlyOrdineCredential: "Agent bearer token file",
  });
  assert(!native.error, JSON.stringify(native.error));
  assert(
    state.approved && state.jobId,
    "External model did not submit the saved RunRequest for App approval",
  );
  const nativeEvents = stdout
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  assert(nativeEvents.some((event) => event.type === "turn.completed"));
  const items = nativeEvents.flatMap((event) =>
    event.item && typeof event.item === "object" ? [event.item as Record<string, unknown>] : [],
  );
  const finalText = items
    .filter((item) => item.type === "agent_message" && typeof item.text === "string")
    .at(-1)?.text;
  assert(typeof finalText === "string");
  const modelResult = JSON.parse(finalText) as {
    requestId: string;
    jobId: string;
    artifactId: string;
    sha256: string;
    contentBase64: string;
  };
  assert.equal(modelResult.requestId, state.requestId);
  assert.equal(modelResult.jobId, state.jobId);
  const resultResponse = await http(`/jobs/${state.jobId}/result`);
  assert.equal(resultResponse.status, 200);
  const result = ExecutionJobResultSchema.parse(resultResponse.body);
  assert.equal(result.state, "succeeded");
  assert.equal(result.artifacts.length, 1);
  const artifact = result.artifacts[0]!;
  const content = await call("artifacts.content", {
    id: artifact.artifactId,
    offset: 0,
    length: 1024 * 1024,
  });
  assert.equal(typeof content.contentBase64, "string");
  const bytes = Buffer.from(content.contentBase64 as string, "base64");
  assert.equal(bytes.length, artifact.sizeBytes);
  assert.equal(sha(bytes), artifact.sha256);
  assert.equal(modelResult.artifactId, artifact.artifactId);
  assert.equal(modelResult.sha256, artifact.sha256);
  assert.equal(modelResult.contentBase64, content.contentBase64);
  if (fullT1) {
    for (const value of ["40", "22", "31", "局限"])
      assert(bytes.toString("utf8").includes(value), `T1 report is missing ${value}`);
  } else assert(bytes.toString("utf8").includes("# EXTERNAL CODEX MCP ACCEPTANCE"));
  assert(
    stdout.includes("artifacts.content"),
    "External model must actually call artifact content tool",
  );
  const events = await call("jobs.events", { jobId: state.jobId, afterSequence: 0, limit: 1000 });
  if (fullT1) {
    const parsedEvents = ExecutionEventSchema.array().parse(events);
    assert(
      parsedEvents.some(
        (event) => event.type === "runtime_event" && event.payload.type === "session",
      ),
    );
    assert(
      parsedEvents.some(
        (event) => event.type === "runtime_event" && event.payload.type === "usage",
      ),
    );
    assert(
      parsedEvents.some(
        (event) =>
          event.type === "runtime_event" &&
          event.payload.type === "terminal" &&
          event.payload.status === "completed",
      ),
    );
  }
  await evidence("result", {
    scenario: fullT1 ? "external-codex-to-internal-codex-T1" : "external-codex-T0",
    modelResult,
    jobResult: result,
    events,
    bytes: bytes.length,
    computedSha256: sha(bytes),
    contentVerified: true,
    callerModelCompleted: true,
    jobSucceeded: true,
    controllerApproved: true,
    callerHadAppToken: false,
  });
  await writeFile(join(outputDirectory, "r12-t1-external-report.md"), bytes);
  console.log(
    `R12_EXTERNAL_SUCCEEDED ${JSON.stringify({ requestId: state.requestId, jobId: state.jobId, artifactId: artifact.artifactId, sha256: artifact.sha256 })}`,
  );
};

const result = await ResultAsync.fromPromise(run(), (error) =>
  error instanceof Error ? error.message : String(error),
);
control.abort();
await client.close();
await transport.close();
await cleanupCodexCredentials(home);
if (result.isErr()) {
  await evidence("failure", {
    message: result.error,
    requestId: state.requestId,
    jobId: state.jobId,
  });
  console.error(`R12_EXTERNAL_FAILED ${result.error}`);
  process.exitCode = 1;
}
