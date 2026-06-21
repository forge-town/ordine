import { spawn } from "node:child_process";
import { logger } from "@repo/logger";
import { err, ok, type Result } from "neverthrow";

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
    let settled = false;
    const child = spawn(opts.command, opts.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...(opts.env ?? {}) },
    });

    const finish = (result: Result<McpToolSummary[], string>) => {
      if (settled) return;
      settled = true;
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
      if (!settled) finish(err(`MCP server exited (code=${code ?? "null"}) before tools/list`));
    });

    let buffer = "";
    let initialized = false;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
        if (!line) continue;

        let msg: JsonRpcMessage;
        try {
          msg = JSON.parse(line) as JsonRpcMessage;
        } catch {
          continue; // 忽略非 JSON 行（部分 server 会往 stdout 打日志）
        }

        if (msg.id === 1 && !initialized) {
          if (msg.error) {
            finish(err(`initialize error: ${msg.error.message ?? "unknown"}`));

            return;
          }
          initialized = true;
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
