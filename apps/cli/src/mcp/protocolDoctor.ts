import { AGENT_CONTROL_TOOLS } from "@repo/agent-control";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFile } from "node:fs/promises";
import { Result, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { McpLaunchSpec } from "./installRegistry";

export const REQUIRED_SESSION_READY_TOOLS = AGENT_CONTROL_TOOLS.filter((tool) =>
  tool.audiences.includes("stdio"),
).map((tool) => tool.name);

export type McpReadinessFailureLayer =
  | "command_not_launchable"
  | "tools_list_failed"
  | "required_tool_missing"
  | "workspace_context_unreadable"
  | "api_unreachable"
  | "db_unreachable"
  | "runtime_catalog_empty"
  | "safe_tool_call_failed";

export type McpProtocolEvidence = {
  commandLaunchable: boolean;
  initialize: boolean;
  toolsList: boolean;
  safeToolCall: boolean;
  toolCount: number;
  requiredTools?: Record<string, boolean>;
  workspaceContext?: boolean;
  policyMode?: string;
  allowWrite?: boolean;
  allowIrreversible?: boolean;
  writePolicy?: "enabled" | "disabled" | "unknown";
  apiReachable?: boolean;
  dbReachable?: boolean;
  runtimeCatalogInitialized?: boolean;
  runtimeCount?: number;
  failureLayer?: McpReadinessFailureLayer;
  message?: string;
};

type ProbeOptions = {
  environmentChecks?: boolean;
};

type JsonObject = Record<string, unknown>;

const WorkspaceContextSchema = z
  .object({
    policy: z
      .object({
        mode: z.enum(["safe", "yolo"]),
        allowWrite: z.boolean(),
        allowIrreversible: z.boolean(),
      })
      .strict(),
  })
  .passthrough();

type HttpProbeResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status?: number; message: string };

const redact = (value: string): string =>
  value
    .replaceAll(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replaceAll(/\b(?:sk|key|token)-[A-Za-z0-9._-]{8,}\b/gi, "[REDACTED]")
    .replaceAll(/((?:token|secret|password|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]");

const errorMessage = (error: unknown): string =>
  redact(error instanceof Error ? error.message : String(error));

const stringEnv = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );

const mergedEnv = (spec: McpLaunchSpec): Record<string, string> => ({
  ...stringEnv(),
  ...spec.env,
});

const parseJson = Result.fromThrowable(JSON.parse, (error) => errorMessage(error));

const headersFromEnv = async (env: Record<string, string>): Promise<Record<string, string>> => {
  const tokenFromFile = env.ORDINE_DESKTOP_AUTH_TOKEN_FILE
    ? await ResultAsync.fromPromise(
        readFile(env.ORDINE_DESKTOP_AUTH_TOKEN_FILE, "utf8"),
        () => undefined,
      )
    : null;
  const token = tokenFromFile?.isOk() ? tokenFromFile.value.trim() : env.ORDINE_DESKTOP_AUTH_TOKEN;

  return token ? { "X-Desktop-Token": token } : {};
};

const requestJson = async (
  env: Record<string, string>,
  path: string,
  timeoutMs: number,
): Promise<HttpProbeResult> => {
  const baseUrl = env.ORDINE_API_URL ?? "http://localhost:9433";
  const requested = await ResultAsync.fromPromise(
    fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: await headersFromEnv(env),
      signal: AbortSignal.timeout(timeoutMs),
    }).then(async (response) => ({
      response,
      text: await response.text(),
    })),
    errorMessage,
  );
  if (requested.isErr()) return { ok: false, message: requested.error };
  if (!requested.value.response.ok) {
    return {
      ok: false,
      status: requested.value.response.status,
      message: redact(requested.value.text || requested.value.response.statusText),
    };
  }
  const parsed = parseJson(requested.value.text);
  if (parsed.isErr())
    return { ok: false, status: requested.value.response.status, message: parsed.error };

  return { ok: true, status: requested.value.response.status, data: parsed.value };
};

const objectFromResource = (value: unknown): JsonObject | null => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const text = (value as { contents?: Array<{ text?: unknown }> }).contents?.[0]?.text;
  if (typeof text !== "string") return null;
  const parsed = parseJson(text);
  if (parsed.isErr()) return null;
  if (parsed.value === null || typeof parsed.value !== "object" || Array.isArray(parsed.value))
    return null;

  return parsed.value as JsonObject;
};

const runtimeCatalogReady = (value: unknown): { initialized: boolean; count: number } => {
  if (!Array.isArray(value)) return { initialized: false, count: 0 };
  const configured = value.filter((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return false;
    const record = entry as JsonObject;

    return (
      typeof record.runtimeConfigId === "string" &&
      record.runtimeConfigId.length > 0 &&
      record.availability === "launchable"
    );
  });

  return { initialized: configured.length > 0, count: configured.length };
};

export const probeMcpProtocol = async (
  spec: McpLaunchSpec,
  timeoutMs = 15_000,
  options: ProbeOptions = {},
): Promise<McpProtocolEvidence> => {
  const env = mergedEnv(spec);
  const transport = new StdioClientTransport({
    command: spec.command,
    args: spec.args,
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "ordine-mcp-doctor", version: "0.0.2" });
  const state: McpProtocolEvidence = {
    commandLaunchable: false,
    initialize: false,
    toolsList: false,
    safeToolCall: false,
    toolCount: 0,
  };
  const timeout = AbortSignal.timeout(timeoutMs);
  const connect = await ResultAsync.fromPromise(
    client.connect(transport, { signal: timeout }),
    errorMessage,
  );
  if (connect.isErr()) {
    await transport.close();

    return { ...state, failureLayer: "command_not_launchable", message: connect.error };
  }
  state.commandLaunchable = true;
  state.initialize = true;

  const listed = await ResultAsync.fromPromise(
    client.listTools(undefined, { signal: timeout }),
    errorMessage,
  );
  if (listed.isErr()) {
    await client.close();

    return { ...state, failureLayer: "tools_list_failed", message: listed.error };
  }
  state.toolsList = true;
  state.toolCount = listed.value.tools.length;
  state.requiredTools = Object.fromEntries(
    REQUIRED_SESSION_READY_TOOLS.map((toolName) => [
      toolName,
      listed.value.tools.some((tool) => tool.name === toolName),
    ]),
  );
  const missingTool = REQUIRED_SESSION_READY_TOOLS.find(
    (toolName) => !state.requiredTools?.[toolName],
  );
  if (missingTool) {
    await client.close();

    return {
      ...state,
      failureLayer: "required_tool_missing",
      message: `tools/list did not advertise ${missingTool}`,
    };
  }

  if (options.environmentChecks !== false) {
    const context = await ResultAsync.fromPromise(
      client.readResource({ uri: "ordine://workspace/context" }, { signal: timeout }),
      errorMessage,
    );
    if (context.isErr()) {
      await client.close();

      return { ...state, failureLayer: "workspace_context_unreadable", message: context.error };
    }
    const contextObject = objectFromResource(context.value);
    const parsedContext = WorkspaceContextSchema.safeParse(contextObject);
    state.workspaceContext = parsedContext.success;
    if (!parsedContext.success) {
      state.writePolicy = "unknown";
      await client.close();

      return {
        ...state,
        failureLayer: "workspace_context_unreadable",
        message: "ordine://workspace/context did not contain a valid policy",
      };
    }
    const policy = parsedContext.data.policy;
    state.policyMode = policy.mode;
    state.allowWrite = policy.allowWrite;
    state.allowIrreversible = policy.allowIrreversible;
    state.writePolicy = policy.mode === "yolo" || policy.allowWrite ? "enabled" : "disabled";

    const health = await requestJson(env, "/health", timeoutMs);
    state.apiReachable = health.ok;
    if (!health.ok) {
      await client.close();

      return {
        ...state,
        failureLayer: "api_unreachable",
        message: `Ordine API /health failed: ${health.status ?? "network"} ${health.message}`,
      };
    }

    const runtimeCatalog = await requestJson(env, "/api/agent-runtimes/catalog", timeoutMs);
    if (runtimeCatalog.ok) {
      const runtime = runtimeCatalogReady(runtimeCatalog.data);
      state.runtimeCatalogInitialized = runtime.initialized;
      state.runtimeCount = runtime.count;
    } else {
      state.runtimeCatalogInitialized = false;
      state.runtimeCount = 0;
    }
  }

  const called = await ResultAsync.fromPromise(
    client.callTool(
      {
        name: "ordine.search",
        arguments: { query: "job", resourceTypes: ["job"], limit: 1 },
      },
      undefined,
      { signal: timeout },
    ),
    errorMessage,
  );
  if (called.isErr()) {
    await client.close();

    return { ...state, failureLayer: "safe_tool_call_failed", message: called.error };
  }
  state.safeToolCall = called.value.isError !== true;
  if (!state.safeToolCall) {
    state.failureLayer = state.apiReachable === false ? "api_unreachable" : "safe_tool_call_failed";
    state.message = "ordine.search for jobs returned an MCP tool error";
  }

  if (options.environmentChecks !== false) {
    const pipelines = await ResultAsync.fromPromise(
      client.callTool(
        {
          name: "ordine.search",
          arguments: { query: "pipeline", resourceTypes: ["pipeline"], limit: 1 },
        },
        undefined,
        { signal: timeout },
      ),
      errorMessage,
    );
    if (pipelines.isErr()) {
      await client.close();

      return { ...state, failureLayer: "db_unreachable", message: pipelines.error };
    }
    state.dbReachable = pipelines.value.isError !== true;
    if (!state.dbReachable) {
      state.failureLayer = "db_unreachable";
      state.message = "ordine.search for pipelines returned an MCP tool error";
    }
    if (state.runtimeCatalogInitialized === false && !state.message) {
      state.failureLayer = "runtime_catalog_empty";
      state.message = "runtime catalog has no configured launchable runtime";
    }
  }

  await client.close();

  return state;
};
