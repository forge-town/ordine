import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { hasMcpConnectorInjection, type McpConnectorInjection } from "../mcp";
import { logger } from "@repo/logger";
import { Result } from "neverthrow";
import { spawnCommand } from "../spawn/spawnCommand";

export interface RunCodexOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  model?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void>;
  onTextDelta?: (text: string) => Promise<void> | void;
  connectorInjection?: McpConnectorInjection;
}

type CodexJsonEvent = {
  type?: unknown;
  item?: {
    type?: unknown;
    text?: unknown;
  };
};

const parseCodexJsonEvent = Result.fromThrowable(
  (line: string) => JSON.parse(line) as CodexJsonEvent,
  () => null,
);

const CODEX_BIN = process.platform === "win32" ? "codex.cmd" : "codex";

export const CODEX_SANDBOX_MODES = {
  readOnly: "read-only",
  workspaceWrite: "workspace-write",
  fullAccess: "danger-full-access",
} as const;

const TOML_KEY_RE = /^[A-Za-z0-9_-]+$/;

const tomlKey = (key: string): string => (TOML_KEY_RE.test(key) ? key : JSON.stringify(key));

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

const tomlTable = (path: readonly string[]): string => `[${path.map(tomlKey).join(".")}]`;

const envLookupName = (name: string): string =>
  process.platform === "win32" ? name.toLowerCase() : name;

const setChildEnvValue = (env: Record<string, string>, name: string, value: string): void => {
  const lookupName = envLookupName(name);
  for (const existingName of Object.keys({ ...process.env, ...env })) {
    if (envLookupName(existingName) !== lookupName) continue;
    const existingValue = env[existingName] ?? process.env[existingName];
    if (existingValue !== undefined && existingValue !== value) {
      throw new Error(`MCP headers define conflicting values for env ${name}`);
    }
  }

  env[name] = value;
};

const buildCodexMcpConfig = (
  injection?: McpConnectorInjection,
): { configToml: string; env: Record<string, string> } => {
  if (!hasMcpConnectorInjection(injection)) {
    return { configToml: "", env: {} };
  }

  const env: Record<string, string> = {};
  const lines: string[] = [];

  for (const [serverIndex, [serverName, serverEntry]] of Object.entries(
    injection.mcpServers,
  ).entries()) {
    const serverPath = ["mcp_servers", serverName];
    const enabledTools = injection.toolNames
      .filter((toolName) => toolName.startsWith(`mcp__${serverName}__`))
      .map((toolName) => toolName.slice(`mcp__${serverName}__`.length));

    lines.push(tomlTable(serverPath));
    if ("command" in serverEntry) {
      lines.push(`command = ${tomlValue(serverEntry.command)}`);
      if (serverEntry.args) lines.push(`args = ${tomlValue(serverEntry.args)}`);
      if (enabledTools.length > 0) {
        lines.push(`enabled_tools = ${tomlValue(enabledTools)}`);
      }
      if (serverEntry.env) {
        lines.push("");
        lines.push(tomlTable([...serverPath, "env"]));
        for (const [envName, envValue] of Object.entries(serverEntry.env)) {
          lines.push(`${tomlKey(envName)} = ${tomlValue(envValue)}`);
        }
      }
    } else {
      lines.push(`url = ${tomlValue(serverEntry.url)}`);
      if (enabledTools.length > 0) {
        lines.push(`enabled_tools = ${tomlValue(enabledTools)}`);
      }
      if (serverEntry.headers) {
        lines.push("");
        lines.push(tomlTable([...serverPath, "env_http_headers"]));
        for (const [headerIndex, [headerName, headerValue]] of Object.entries(
          serverEntry.headers,
        ).entries()) {
          const envName = `ORDINE_MCP_${serverIndex}_${headerIndex}`;
          setChildEnvValue(env, envName, headerValue);
          lines.push(`${tomlKey(headerName)} = ${tomlValue(envName)}`);
        }
      }
    }

    lines.push("");
  }

  return { configToml: lines.join("\n"), env };
};

const createIsolatedCodexHome = async (configToml: string): Promise<string> => {
  const isolatedHome = await mkdtemp(join(tmpdir(), "ordine-codex-home-"));
  const sourceHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const setup = copyFile(join(sourceHome, "auth.json"), join(isolatedHome, "auth.json"))
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    })
    .then(() => writeFile(join(isolatedHome, "config.toml"), configToml, { mode: 0o600 }));
  await setup.catch(async (error) => {
    await rm(isolatedHome, { recursive: true, force: true });
    throw error;
  });

  return isolatedHome;
};

const cleanupPath = async (path: string, label: string): Promise<void> => {
  const cleanup = await rm(path, { recursive: true, force: true }).then(
    () => null,
    (error) => error,
  );
  if (cleanup) {
    logger.debug({ err: String(cleanup) }, `runCodex: failed to remove ${label}`);
  }
};

export const runCodex = async ({
  systemPrompt,
  userPrompt,
  cwd,
  sandbox = "read-only",
  model,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
  onTextDelta,
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
  const codexMcpConfig = buildCodexMcpConfig(connectorInjection);
  const isolatedCodexHome = await createIsolatedCodexHome(codexMcpConfig.configToml);

  const args = [
    "exec",
    "--sandbox",
    sandbox,
    "--ephemeral",
    "--skip-git-repo-check",
    "--json",
    "-C",
    cwd,
    "--output-last-message",
    outputFile,
  ];

  if (model) {
    args.push("--model", model);
  }

  logger.info({ cwd, sandbox }, "runCodex: starting");

  const execution = async (): Promise<string> => {
    await onProgress?.(`[Codex] Starting codex exec (cwd=${cwd}, sandbox=${sandbox})...`);

    return new Promise<string>((resolve, reject) => {
      const child = spawnCommand(CODEX_BIN, args, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ...codexMcpConfig.env,
          CODEX_HOME: isolatedCodexHome,
        },
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      const completion = { settled: false };
      const streamState = {
        lineBuffer: "",
        parsedEventCount: 0,
        emittedAgentMessage: false,
        lastAgentMessage: "",
        delivery: Promise.resolve(),
      };

      const processStreamLine = (line: string) => {
        if (!line.trim()) return;

        const parsed = parseCodexJsonEvent(line.trim());
        if (parsed.isErr()) return;
        streamState.parsedEventCount += 1;

        const event = parsed.value;
        if (
          event.type !== "item.completed" ||
          event.item?.type !== "agent_message" ||
          typeof event.item.text !== "string" ||
          event.item.text.length === 0
        ) {
          return;
        }

        const textDelta = streamState.emittedAgentMessage
          ? `\n\n${event.item.text}`
          : event.item.text;
        streamState.emittedAgentMessage = true;
        streamState.lastAgentMessage = event.item.text;
        streamState.delivery = streamState.delivery
          .then(() => onTextDelta?.(textDelta))
          .then(() => undefined)
          .catch((error) => {
            logger.warn({ err: String(error) }, "runCodex: text delta callback failed");
          });
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
        streamState.lineBuffer += chunk.toString("utf8");
        const lines = streamState.lineBuffer.split("\n");
        streamState.lineBuffer = lines.pop() ?? "";
        for (const line of lines) processStreamLine(line);
      });
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      const prompt = `<system>${systemPrompt}</system>\n\n${truncatedPrompt}`;
      child.stdin.write(prompt);
      child.stdin.end();

      const timer = setTimeout(() => {
        if (completion.settled) return;
        completion.settled = true;
        child.kill("SIGTERM");
        reject(new Error(`codex timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      child.on("error", (error) => {
        if (completion.settled) return;
        completion.settled = true;
        clearTimeout(timer);
        logger.error({ err: error.message }, "runCodex: spawn error");
        void onProgress?.(`[Codex] Spawn error: ${error.message}`);
        reject(error);
      });

      const handleCompletion = (code: number | null) => {
        if (completion.settled) return;
        completion.settled = true;
        clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        void (async () => {
          processStreamLine(streamState.lineBuffer);
          await streamState.delivery;
          const output = await readFile(outputFile, "utf8").then(
            (fileOutput) => fileOutput,
            () =>
              streamState.lastAgentMessage ||
              (streamState.parsedEventCount === 0 ? stdout : ""),
          );

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
        })();
      };

      // Codex may launch long-lived MCP descendants that inherit its stdio handles. In that
      // situation Node/Bun emits `exit` for the Codex process but can delay `close` indefinitely
      // while those descendant pipes remain open. The output file is finalized before `exit`, so
      // settle there and retain `close` as a compatibility fallback for mocked/older runtimes.
      child.on("exit", handleCompletion);
      child.on("close", handleCompletion);
    });
  };

  return execution().finally(async () => {
    await cleanupPath(outputFile, "output file");
    await cleanupPath(isolatedCodexHome, "isolated home");
  });
};
