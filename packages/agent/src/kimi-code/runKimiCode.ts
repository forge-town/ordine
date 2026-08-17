import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "@repo/logger";
import { err, ResultAsync } from "neverthrow";
import type { McpConnectorInjection, McpServerEntry } from "../mcp";
import { runCliToCompletion } from "../spawn";

export interface RunKimiCodeOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
  connectorInjection?: McpConnectorInjection;
}

const KIMI_BIN = "kimi";
const EMPTY_MCP_CONFIG = { mcpServers: {} } as const;
const MCP_RETRY_GUIDANCE =
  "check the authorized MCP server command and network, then retry; remove the MCP tool from this job if it is not required";

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const writeKimiMcpConfig = async (injection?: McpConnectorInjection): Promise<string> => {
  const configPath = join(tmpdir(), `ordine-kimi-mcp-${crypto.randomUUID()}.json`);
  const config = injection ? { mcpServers: injection.mcpServers } : EMPTY_MCP_CONFIG;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

  return configPath;
};

const cleanupKimiMcpConfig = async (configPath: string): Promise<void> => {
  const cleanupError = await rm(configPath, { force: true }).then(
    () => null,
    (error) => error,
  );
  if (cleanupError) {
    logger.debug({ err: String(cleanupError) }, "runKimiCode: failed to remove MCP config");
  }
};

const summarizeTraceValue = (value: string, maxChars = 160): string =>
  value.replaceAll(/\s+/g, " ").trim().slice(0, maxChars);

const summarizeMcpCommand = (entry: McpServerEntry): string =>
  "command" in entry
    ? `${summarizeTraceValue(entry.command)} (args=${entry.args?.length ?? 0})`
    : "HTTP endpoint";

const summarizeMcpFailureReason = (reason: string): string => summarizeTraceValue(reason, 300);

const extractMcpFailureReason = (message: string): string => {
  const reason =
    message.match(/McpError\((['"])(.*?)\1\)/s)?.[2] ??
    message.match(/RuntimeError\((['"])(.*?)\1\)/s)?.[2] ??
    message.match(/Failed to connect MCP servers:\s*(.+?)(?:\nSee logs:|$)/s)?.[1] ??
    "MCP connection failed";

  return summarizeMcpFailureReason(reason);
};

const extractExitReason = (message: string): string =>
  message.match(/exited with (code [^:]+|signal [^:]+):/)?.[1] ?? "unknown";

const buildKimiMcpStartupError = async ({
  error,
  injection,
  onProgress,
}: {
  error: Error;
  injection?: McpConnectorInjection;
  onProgress?: RunKimiCodeOptions["onProgress"];
}): Promise<Error> => {
  if (!error.message.includes("Failed to connect MCP server")) return error;

  const configuredServers = Object.entries(injection?.mcpServers ?? {});
  const namedFailures = configuredServers.filter(([serverName]) =>
    error.message.includes(serverName),
  );
  const failedServers = namedFailures.length > 0 ? namedFailures : configuredServers;
  const reason = extractMcpFailureReason(error.message);
  const exit = extractExitReason(error.message);

  for (const [serverName, entry] of failedServers) {
    await onProgress?.(
      `[MCP Failure] server=${serverName}; command=${summarizeMcpCommand(entry)}; exit=${exit}; reason=${reason}; retry=${MCP_RETRY_GUIDANCE}`,
    );
  }

  const serverSummary = failedServers.map(([serverName]) => serverName).join(", ") || "unknown";

  return new Error(
    `Kimi MCP startup failed: server=${serverSummary}; exit=${exit}; reason=${reason}; retry=${MCP_RETRY_GUIDANCE}`,
    { cause: error },
  );
};

const buildPrompt = (systemPrompt: string, userPrompt: string): string => {
  if (!systemPrompt) {
    return userPrompt;
  }

  return `${systemPrompt}\n\n${userPrompt}`;
};

export const runKimiCode = ({
  systemPrompt,
  userPrompt,
  cwd,
  model,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
  connectorInjection,
}: RunKimiCodeOptions): ResultAsync<string, Error> => {
  return ResultAsync.fromPromise(writeKimiMcpConfig(connectorInjection), toError).andThen(
    (mcpConfigPath) => {
      // --quiet = --print + text output + final message only (non-interactive,
      // auto-approves tool calls for this invocation). An explicit config file,
      // including an empty one, suppresses Kimi's ~/.kimi/mcp.json fallback.
      const args = [
        "--quiet",
        "--mcp-config-file",
        mcpConfigPath,
        "--work-dir",
        cwd,
        "--prompt",
        buildPrompt(systemPrompt, userPrompt),
      ];

      if (model) {
        args.push("--model", model);
      }

      logger.info({ cwd, model }, "runKimiCode: starting");
      const execution = Promise.resolve(
        onProgress?.(`[Kimi] Starting kimi --quiet (cwd=${cwd})...`),
      )
        .then(() =>
          runCliToCompletion({
            command: KIMI_BIN,
            args,
            cwd,
            timeoutMs,
            label: "Kimi",
            onProgress,
          }),
        )
        .then(async (result) =>
          result.isErr()
            ? err(
                await buildKimiMcpStartupError({
                  error: result.error,
                  injection: connectorInjection,
                  onProgress,
                }),
              )
            : result,
        )
        .finally(() => cleanupKimiMcpConfig(mcpConfigPath));

      return ResultAsync.fromPromise(execution, toError).andThen((result) => result);
    },
  );
};
