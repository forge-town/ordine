import { spawn } from "node:child_process";
import { logger } from "@repo/logger";
import { err, ok, Result } from "neverthrow";

/**
 * 与 `@repo/schemas` 的 McpToolSummary 结构一致，但本包不依赖 schemas——
 * 在此本地声明，service 侧按结构赋值即可（避免新增跨包依赖）。
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

const encodeLine = (msg: unknown): string => `${JSON.stringify(msg)}\n`;

// neverthrow 包裹 JSON.parse，替代 try-catch（满足 ordine-error/no-try）。
const parseJsonRpc = Result.fromThrowable(
  (line: string): JsonRpcMessage => JSON.parse(line) as JsonRpcMessage,
);

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
 * 极简 MCP stdio 客户端：spawn server，按 JSON-RPC over stdio（换行分帧）走
 * initialize → notifications/initialized → tools/list，拿到工具列表即成功、用完即 kill。
 * 依赖无关（不引 @modelcontextprotocol/sdk）。**必须真拿到 tools 才算成功**——
 * 进程起来 ≠ connected（防 CONN-01 假态复发）。
 */
export const listMcpToolsStdio = (
  opts: ListMcpToolsOptions,
): Promise<Result<McpToolSummary[], string>> => {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    // 用 const 持有可变状态（满足 ordine-vars/no-let）。
    const state = { settled: false, initialized: false, buffer: "" };
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

    const handleMessage = (msg: JsonRpcMessage) => {
      if (msg.id === 1 && !state.initialized) {
        if (msg.error) {
          finish(err(`initialize error: ${msg.error.message ?? "unknown"}`));

          return;
        }
        state.initialized = true;
        child.stdin.write(encodeLine({ jsonrpc: "2.0", method: "notifications/initialized" }));
        child.stdin.write(encodeLine({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
      } else if (msg.id === 2) {
        if (msg.error) {
          finish(err(`tools/list error: ${msg.error.message ?? "unknown"}`));

          return;
        }
        finish(ok(toToolSummaries(msg.result?.tools)));
      }
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      state.buffer += chunk;
      const segments = state.buffer.split("\n");
      state.buffer = segments.pop() ?? "";
      for (const segment of segments) {
        if (state.settled) break;
        const line = segment.trim();
        if (!line) continue;
        // 忽略非 JSON 行（部分 server 会往 stdout 打日志）：解析失败则跳过。
        parseJsonRpc(line).map(handleMessage);
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
