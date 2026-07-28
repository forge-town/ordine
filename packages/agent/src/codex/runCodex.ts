import { readFile, unlink } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasMcpConnectorInjection, type McpConnectorInjection } from "../mcp";
import { logger } from "@repo/logger";
import { spawnCommand } from "../spawn/spawnCommand";

export interface RunCodexOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  model?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void>;
  connectorInjection?: McpConnectorInjection;
}

const CODEX_BIN = process.platform === "win32" ? "codex.cmd" : "codex";

export const CODEX_SANDBOX_MODES = {
  readOnly: "read-only",
  workspaceWrite: "workspace-write",
  fullAccess: "danger-full-access",
} as const;

const TOML_KEY_RE = /^[A-Za-z0-9_-]+$/;

const tomlKey = (key: string): string =>
  TOML_KEY_RE.test(key) ? key : JSON.stringify(key);

const tomlValue = (value: unknown): string => {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => tomlValue(item)).join(", ")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => `${tomlKey(key)} = ${tomlValue(entryValue)}`);

    return `{ ${entries.join(", ")} }`;
  }

  throw new Error("unsupported codex config value");
};

const buildCodexMcpOverrides = (
  injection?: McpConnectorInjection,
): { configArgs: string[]; env: Record<string, string> } => {
  if (!hasMcpConnectorInjection(injection)) {
    return { configArgs: [], env: {} };
  }

  const env: Record<string, string> = {};
  const configArgs: string[] = [];

  for (const [serverName, serverEntry] of Object.entries(injection.mcpServers)) {
    const serverPrefix = `mcp_servers.${serverName}`;
    const enabledTools = injection.toolNames
      .filter((toolName) => toolName.startsWith(`mcp__${serverName}__`))
      .map((toolName) => toolName.slice(`mcp__${serverName}__`.length));

    const serverConfig: Record<string, unknown> = {};
    if ("command" in serverEntry) {
      serverConfig.command = serverEntry.command;
      if (serverEntry.args) serverConfig.args = serverEntry.args;
      if (serverEntry.env) {
        serverConfig.env_vars = Object.keys(serverEntry.env).sort();
        for (const [envName, envValue] of Object.entries(serverEntry.env)) {
          env[envName] = envValue;
        }
      }
      if (enabledTools.length > 0) {
        serverConfig.enabled_tools = enabledTools;
      }
    } else {
      serverConfig.url = serverEntry.url;
      if (serverEntry.headers) {
        const envHeaders: Record<string, string> = {};
        for (const [headerName, headerValue] of Object.entries(serverEntry.headers)) {
          const envName = `ORDINE_MCP_${serverName.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_")}_${headerName.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_")}`;
          env[envName] = headerValue;
          envHeaders[headerName] = envName;
        }
        if (Object.keys(envHeaders).length > 0) {
          serverConfig.env_http_headers = envHeaders;
        }
      }
      if (enabledTools.length > 0) {
        serverConfig.enabled_tools = enabledTools;
      }
    }

    configArgs.push(
      "-c",
      `${serverPrefix}=${tomlValue(serverConfig)}`,
    );
  }

  return { configArgs, env };
};

export const runCodex = async ({
  systemPrompt,
  userPrompt,
  cwd,
  sandbox = "read-only",
  model,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
  connectorInjection,
}: RunCodexOptions): Promise<string> => {
  const MAX_INPUT_CHARS = 50_000;
  const truncatedPrompt =
    userPrompt.length > MAX_INPUT_CHARS
      ? `${userPrompt.slice(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`
      : userPrompt;
  const outputFile = join(
    tmpdir(),
    `ordine-codex-last-message-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  );
  const codexMcpOverrides = buildCodexMcpOverrides(connectorInjection);

  const args = [
    ...codexMcpOverrides.configArgs,
    "exec",
    "--sandbox",
    sandbox,
    "--ephemeral",
    "--skip-git-repo-check",
    "-C",
    cwd,
    "--output-last-message",
    outputFile,
  ];

  if (model) {
    args.push("--model", model);
  }

  logger.info({ cwd, sandbox }, "runCodex: starting");
  await onProgress?.(`[Codex] Starting codex exec (cwd=${cwd}, sandbox=${sandbox})...`);

  return new Promise<string>((resolve, reject) => {
    const removeOutputFile = () => {
      unlink(outputFile, (error) => {
        if (error && error.code !== "ENOENT") {
          logger.debug({ err: error.message }, "runCodex: failed to remove output file");
        }
      });
    };

    const child = spawnCommand(CODEX_BIN, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...codexMcpOverrides.env },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const prompt = `<system>${systemPrompt}</system>\n\n${truncatedPrompt}`;
    child.stdin.write(prompt);
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      removeOutputFile();
      reject(new Error(`codex timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      removeOutputFile();
      logger.error({ err: error.message }, "runCodex: spawn error");
      void onProgress?.(`[Codex] Spawn error: ${error.message}`);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      readFile(outputFile, "utf8", (readError, fileOutput) => {
        removeOutputFile();
        const output = readError ? stdout : fileOutput;

        if (code !== 0 && output.trim().length === 0) {
          logger.error({ code, stderr: stderr.slice(0, 500) }, "runCodex: non-zero exit");
          void onProgress?.(`[Codex] Exit code ${code}: ${stderr.slice(0, 200)}`);
          reject(new Error(`codex exited with code ${code}: ${stderr.slice(0, 500)}`));

          return;
        }

        if (code !== 0) {
          logger.warn(
            { code, outputLen: output.length, stderr: stderr.slice(0, 300) },
            "runCodex: non-zero exit but output present, using output",
          );
          void onProgress?.(
            `[Codex] Exit code ${code} (non-fatal, ${output.length} chars captured)`,
          );
        }

        if (stderr) {
          logger.debug({ stderr: stderr.slice(0, 500) }, "runCodex: stderr");
        }

        logger.info({ len: output.length }, "runCodex: complete");
        void onProgress?.(`[Codex] Complete (${output.length} chars)`);
        resolve(output);
      });
    });
  });
};
