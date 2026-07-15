import { spawn } from "node:child_process";
import { logger } from "@repo/logger";
import { err, ok, Result } from "neverthrow";

/**
 * Structurally identical to `@repo/schemas`' McpToolSummary, but this package
 * does not depend on schemas — declared locally so the service layer can
 * assign by structure (avoids a new cross-package dependency).
 */
export type McpToolSummary = { name: string; description?: string };

export type ListMcpToolsOptions = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcMessage = {
  id?: number | string;
  result?: { tools?: { name?: unknown; description?: unknown }[] };
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
 * Minimal MCP stdio client: spawns the server, speaks JSON-RPC over stdio
 * (newline-delimited framing) through initialize → notifications/initialized →
 * tools/list, treats receiving the tool list as success, and kills the process
 * when done. Dependency-free (no @modelcontextprotocol/sdk). **Success requires
 * actually receiving tools** — a live process alone is not "connected".
 */
export const listMcpToolsStdio = (
  opts: ListMcpToolsOptions,
): Promise<Result<McpToolSummary[], string>> => {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const state = { settled: false };
    const child = spawn(opts.command, opts.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
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

    const stream = { buffer: "", initialized: false };
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
            encodeLine({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
          );
        } else if (msg.id === 2) {
          if (msg.error) {
            finish(err(`tools/list error: ${msg.error.message ?? "unknown"}`));

            return;
          }
          finish(ok(toToolSummaries(msg.result?.tools)));

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
