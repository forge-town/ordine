import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ResultAsync } from "neverthrow";
import type { McpLaunchSpec } from "./installRegistry";

export type McpProtocolEvidence = {
  commandLaunchable: boolean;
  initialize: boolean;
  toolsList: boolean;
  safeToolCall: boolean;
  toolCount: number;
  message?: string;
};

const redact = (value: string): string =>
  value
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|key|token)-[A-Za-z0-9._-]{8,}\b/gi, "[REDACTED]")
    .replace(/((?:token|secret|password|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]");

const errorMessage = (error: unknown): string =>
  redact(error instanceof Error ? error.message : String(error));

export const probeMcpProtocol = async (
  spec: McpLaunchSpec,
  timeoutMs = 15_000,
): Promise<McpProtocolEvidence> => {
  const transport = new StdioClientTransport({
    command: spec.command,
    args: spec.args,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ),
      ...spec.env,
    },
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
  const connect = await ResultAsync.fromPromise(client.connect(transport, { signal: timeout }), errorMessage);
  if (connect.isErr()) {
    await transport.close();

    return { ...state, message: connect.error };
  }
  state.commandLaunchable = true;
  state.initialize = true;

  const listed = await ResultAsync.fromPromise(client.listTools(undefined, { signal: timeout }), errorMessage);
  if (listed.isErr()) {
    await client.close();

    return { ...state, message: listed.error };
  }
  state.toolsList = true;
  state.toolCount = listed.value.tools.length;
  if (!listed.value.tools.some((tool) => tool.name === "ordine.list_jobs")) {
    await client.close();

    return { ...state, message: "tools/list did not advertise ordine.list_jobs" };
  }

  const called = await ResultAsync.fromPromise(
    client.callTool(
      { name: "ordine.list_jobs", arguments: {} },
      undefined,
      { signal: timeout },
    ),
    errorMessage,
  );
  await client.close();
  if (called.isErr()) return { ...state, message: called.error };
  state.safeToolCall = called.value.isError !== true;
  if (!state.safeToolCall) state.message = "ordine.list_jobs returned an MCP tool error";

  return state;
};
