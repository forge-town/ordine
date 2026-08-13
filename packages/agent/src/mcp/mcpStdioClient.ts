import { logger } from "@repo/logger";
import { err, ok, Result } from "neverthrow";
import { spawnCommand } from "../spawn/spawnCommand";

/**
 * Structurally identical to `@repo/schemas`' McpToolSummary, but this package
 * does not depend on schemas — declared locally so the service layer can
 * assign by structure (avoids a new cross-package dependency).
 */
export type McpToolSummary = { name: string; description?: string };

export type ListMcpToolsOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcMessage = {
  id?: number | string;
  result?: { tools?: unknown; nextCursor?: unknown };
  error?: { message?: string };
};

// neverthrow-wrapped JSON.parse: non-JSON lines (some servers log to stdout)
// take the isErr branch and are skipped — no bare try/catch.
const safeJsonParse = Result.fromThrowable(
  (line: string) => JSON.parse(line) as JsonRpcMessage,
  () => "non-JSON line",
);

const encodeLine = (msg: unknown): string => `${JSON.stringify(msg)}\n`;

const toToolSummaries = (raw: unknown): McpToolSummary[] => {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((tool) => {
    if (typeof tool !== "object" || tool === null) return [];
    const name = (tool as { name?: unknown }).name;
    if (typeof name !== "string" || name.length === 0) return [];
    const description = (tool as { description?: unknown }).description;

    return [{ name, ...(typeof description === "string" ? { description } : {}) }];
  });
};

/**
 * Minimal MCP stdio client: spawns the server (platform-aware, via spawnCommand
 * so `command: "npx"` works on Windows), speaks JSON-RPC over stdio
 * (newline-delimited framing) through initialize → notifications/initialized →
 * tools/list, follows pagination cursors, validates the result, and kills the
 * process when done. Dependency-free (no @modelcontextprotocol/sdk). **Success
 * requires a well-formed tool list** — a live process, or a result with no
 * `tools` array, is not "connected". An explicit `tools: []` is a valid empty
 * list; a missing/malformed `tools` is an error.
 */
export const listMcpToolsStdio = (
  opts: ListMcpToolsOptions,
): Promise<Result<McpToolSummary[], string>> => {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const state = { settled: false };
    const child = spawnCommand(opts.command, opts.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      ...(opts.cwd ? { cwd: opts.cwd } : {}),
      env: { ...process.env, ...opts.env },
    });

    const finish = (result: Result<McpToolSummary[], string>) => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      resolve(result);
    };

    const timer = setTimeout(
      () => finish(err(`MCP handshake timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );

    child.on("error", (error) => finish(err(`spawn failed: ${error.message}`)));
    child.on("exit", (code) => {
      if (!state.settled)
        finish(err(`MCP server exited (code=${code ?? "null"}) before tools/list`));
    });

    const stream = {
      buffer: "",
      initialized: false,
      toolListId: 2,
      tools: [] as McpToolSummary[],
      seenCursors: new Set<string>(),
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stream.buffer += chunk;
      const lines = stream.buffer.split("\n");
      stream.buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const parsed = safeJsonParse(line);
        if (parsed.isErr()) continue; // skip non-JSON lines (some servers log to stdout)
        const msg = parsed.value;

        if (msg.id === 1 && !stream.initialized) {
          if (msg.error) {
            finish(err(`initialize error: ${msg.error.message ?? "unknown"}`));

            return;
          }
          stream.initialized = true;
          child.stdin.write(encodeLine({ jsonrpc: "2.0", method: "notifications/initialized" }));
          child.stdin.write(
            encodeLine({ jsonrpc: "2.0", id: stream.toolListId, method: "tools/list", params: {} }),
          );
        } else if (msg.id === stream.toolListId) {
          if (msg.error) {
            finish(err(`tools/list error: ${msg.error.message ?? "unknown"}`));

            return;
          }

          const toolsRaw = msg.result?.tools;
          // A missing/non-array `tools` is a malformed result, not an empty tool
          // set — only an explicit `tools: []` counts as a valid empty list.
          if (!Array.isArray(toolsRaw)) {
            finish(err("tools/list result missing a 'tools' array"));

            return;
          }
          stream.tools.push(...toToolSummaries(toolsRaw));

          // Pagination: the tool list may be split across pages. Keep requesting
          // tools/list with the returned cursor and accumulate until it is gone.
          const nextCursor = msg.result?.nextCursor;
          if (typeof nextCursor === "string" && nextCursor.length > 0) {
            // Guard a misbehaving server that echoes the same cursor forever:
            // fail fast instead of looping until the timeout.
            if (stream.seenCursors.has(nextCursor)) {
              finish(err(`tools/list pagination cursor repeated: ${nextCursor}`));

              return;
            }
            stream.seenCursors.add(nextCursor);
            stream.toolListId += 1;
            child.stdin.write(
              encodeLine({
                jsonrpc: "2.0",
                id: stream.toolListId,
                method: "tools/list",
                params: { cursor: nextCursor },
              }),
            );

            return;
          }

          finish(ok(stream.tools));

          return;
        }
      }
    });

    logger.info({ command: opts.command }, "listMcpToolsStdio: starting handshake");
    child.stdin.write(
      encodeLine({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "ordine", version: "0.0.0" },
        },
      }),
    );
  });
};
