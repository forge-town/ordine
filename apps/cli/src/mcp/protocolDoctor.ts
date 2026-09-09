import { ExecutionJobSchema, ExecutionReadinessSchema } from "@repo/schemas";
import { ORDINE_MCP_TOOLS } from "./toolCatalog";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Result, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { McpLaunchSpec } from "./installRegistry";
import { createApiClient } from "../api";
import { resolveApiAuthentication } from "../auth";

export const REQUIRED_SESSION_READY_TOOLS = ORDINE_MCP_TOOLS.map((tool) => tool.name);

export type McpReadinessFailureLayer =
  | "command_not_launchable"
  | "tools_list_failed"
  | "required_tool_missing"
  | "workspace_context_unreadable"
  | "api_unreachable"
  | "authentication_configuration"
  | "authentication_failed"
  | "capability_check_failed"
  | "db_unreachable"
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

const redact = (value: string): string =>
  value
    .replaceAll(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replaceAll(/\b(?:sk|key|token)-[A-Za-z0-9._-]{8,}\b/gi, "[REDACTED]")
    .replaceAll(/((?:token|secret|password|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]");

const errorMessage = (error: unknown): string =>
  redact(error instanceof Error ? error.message : String(error));

const toolFailureLayer = (
  result: unknown,
  fallback: McpReadinessFailureLayer,
): McpReadinessFailureLayer =>
  /\b(?:401|403|API_UNAUTHORIZED)\b/.test(JSON.stringify(result))
    ? "authentication_failed"
    : fallback;

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

const requestJson = async (env: Record<string, string>, path: string, timeoutMs: number) =>
  createApiClient({ environment: () => env, timeoutMs }).get<unknown>(path);

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
  if (options.environmentChecks !== false) {
    const authentication = await resolveApiAuthentication(env);
    if (authentication.isErr())
      return {
        ...state,
        failureLayer: "authentication_configuration",
        message: authentication.error.message,
      };
  }
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

    const readiness = await requestJson(env, "/api/v2/readiness", timeoutMs);
    state.apiReachable = readiness.ok || (readiness.status ?? 0) > 0;
    if (!readiness.ok) {
      await client.close();

      return {
        ...state,
        failureLayer:
          readiness.code === "API_UNAUTHORIZED"
            ? "authentication_failed"
            : readiness.code.startsWith("AUTH_") || readiness.code === "API_CONFIG_INVALID"
              ? "authentication_configuration"
              : "api_unreachable",
        message: readiness.message,
      };
    }
    const parsed = ExecutionReadinessSchema.safeParse(readiness.data);
    if (!parsed.success) {
      await client.close();

      return {
        ...state,
        failureLayer: "capability_check_failed",
        message: "Execution v2 readiness response is invalid or incompatible.",
      };
    }
    state.dbReachable = parsed.data.database.reachable;
    state.runtimeCount = parsed.data.capabilities.localAgentRuntimeIds.length;
    state.runtimeCatalogInitialized = state.runtimeCount > 0;
    if (parsed.data.status !== "ready") {
      await client.close();

      return {
        ...state,
        failureLayer: "db_unreachable",
        message: "Execution v2 requires a reachable database with schema version 2.",
      };
    }
  }

  const called = await ResultAsync.fromPromise(
    client.callTool(
      {
        name: "ordine.v2.jobs.list",
        arguments: {},
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
  if (state.safeToolCall) {
    const payload = z
      .object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })) })
      .safeParse(called.value);
    const text = payload.success
      ? payload.data.content.find((entry) => entry.type === "text")?.text
      : undefined;
    const decoded = typeof text === "string" ? parseJson(text) : null;
    state.safeToolCall =
      decoded?.isOk() === true && z.array(ExecutionJobSchema).safeParse(decoded.value).success;
  }
  if (!state.safeToolCall) {
    state.failureLayer = toolFailureLayer(called.value, "safe_tool_call_failed");
    state.message = "ordine.v2.jobs.list returned an MCP tool error";
    await client.close();

    return state;
  }

  await client.close();

  return state;
};
