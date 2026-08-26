import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { hasMcpConnectorInjection, type McpConnectorInjection } from "../mcp";
import { logger } from "@repo/logger";
import type { RuntimeEvent, RuntimeTerminalStatus } from "@repo/schemas";
import { Result, ResultAsync } from "neverthrow";
import { spawnCommand } from "../spawn/spawnCommand";
import {
  createJsonEventStreamState,
  handleJsonEventStreamLine,
} from "../runtime/jsonEventStreamMapper";
import { createRuntimeEventEmitter } from "../runtime/runtimeEventEmitter";
import { terminateRuntimeProcess } from "../runtime/terminateRuntimeProcess";

export interface RunCodexOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  fullAccessConfirmed?: boolean;
  model?: string;
  reasoningEffort?: string;
  speed?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void>;
  onTextDelta?: (text: string) => Promise<void> | void;
  connectorInjection?: McpConnectorInjection;
  signal?: AbortSignal;
  resumeSessionId?: string;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
  executablePath?: string;
  networkAccess?: boolean;
  environment?: Readonly<Record<string, string>>;
  agentControlMode?: boolean;
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
const CODEX_RESUME_PREFIX = "ordine-codex:";
const CODEX_CONTROL_DISABLED_FEATURES = [
  "apps",
  "browser_use",
  "browser_use_external",
  "browser_use_full_cdp_access",
  "code_mode",
  "code_mode_host",
  "computer_use",
  "image_generation",
  "in_app_browser",
  "js_repl",
  "multi_agent",
  "plugins",
  "shell_tool",
  "skill_mcp_dependency_install",
  "skill_search",
  "unified_exec",
  "view_image",
  "workspace_dependencies",
] as const;

type CodexResumeHandle = {
  version: 1;
  threadId: string;
  codexHome: string;
};

const parseResumeHandleJson = Result.fromThrowable(
  (encoded: string) => JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown,
  () => null,
);

const encodeResumeHandle = (threadId: string, codexHome: string): string =>
  `${CODEX_RESUME_PREFIX}${Buffer.from(
    JSON.stringify({ version: 1, threadId, codexHome } satisfies CodexResumeHandle),
  ).toString("base64url")}`;

const decodeResumeHandle = (value: string): CodexResumeHandle | undefined => {
  if (!value.startsWith(CODEX_RESUME_PREFIX) || value.length > 4096) return undefined;
  const parsed = parseResumeHandleJson(value.slice(CODEX_RESUME_PREFIX.length));
  if (parsed.isErr() || !parsed.value || typeof parsed.value !== "object") return undefined;
  const candidate = parsed.value as Partial<CodexResumeHandle>;
  const managedHomePrefix = resolvePath(tmpdir(), "ordine-codex-home-");
  if (
    candidate.version !== 1 ||
    typeof candidate.threadId !== "string" ||
    candidate.threadId.length === 0 ||
    candidate.threadId.length > 512 ||
    typeof candidate.codexHome !== "string" ||
    !resolvePath(candidate.codexHome).startsWith(managedHomePrefix)
  ) {
    return undefined;
  }

  return candidate as CodexResumeHandle;
};

export const CODEX_SANDBOX_MODES = {
  readOnly: "read-only",
  workspaceWrite: "workspace-write",
  fullAccess: "danger-full-access",
} as const;

const CODEX_SHELL_ENVIRONMENT_INCLUDE_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "TERM",
  "COLORTERM",
  "SYSTEMROOT",
  "COMSPEC",
  "PATHEXT",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "HOMEDRIVE",
  "HOMEPATH",
  "OD_BIN",
  "OD_HYPERFRAMES_BIN",
  "OD_NODE_BIN",
  "OD_DAEMON_URL",
  "OD_TOOL_TOKEN",
  "OD_DATA_DIR",
  "OD_PROJECT_ID",
  "OD_PROJECT_DIR",
] as const;

export const codexOpenDesignShellEnvironmentArgs = (
  extraKeys: readonly string[] = [],
): string[] => {
  const includeOnly = [...new Set([...CODEX_SHELL_ENVIRONMENT_INCLUDE_KEYS, ...extraKeys])]
    .map((key) => JSON.stringify(key))
    .join(",");

  return [
    "-c",
    "allow_login_shell=false",
    "-c",
    'shell_environment_policy.inherit="all"',
    "-c",
    "shell_environment_policy.ignore_default_excludes=true",
    "-c",
    `shell_environment_policy.include_only=[${includeOnly}]`,
  ];
};

export const resolveCodexSandbox = (
  requested: NonNullable<RunCodexOptions["sandbox"]>,
): NonNullable<RunCodexOptions["sandbox"]> => requested;

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

const buildCodexRuntimeConfig = (mcpConfigToml: string): string =>
  ['approval_policy = "never"', ...(mcpConfigToml ? ["", mcpConfigToml.trimEnd()] : []), ""].join(
    "\n",
  );

const createIsolatedCodexHome = async (configToml: string): Promise<string> => {
  const isolatedHome = await mkdtemp(join(tmpdir(), "ordine-codex-home-"));
  const sourceHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const copyResult = await ResultAsync.fromPromise(
    copyFile(join(sourceHome, "auth.json"), join(isolatedHome, "auth.json")),
    (error) => error as NodeJS.ErrnoException,
  );
  if (copyResult.isErr() && copyResult.error.code !== "ENOENT") {
    await rm(isolatedHome, { recursive: true, force: true });
    throw copyResult.error;
  }
  const configResult = await ResultAsync.fromPromise(
    writeFile(join(isolatedHome, "config.toml"), configToml, { mode: 0o600 }),
    (error) => error,
  );
  if (configResult.isErr()) {
    await rm(isolatedHome, { recursive: true, force: true });
    throw configResult.error;
  }

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

const scrubCodexConfig = async (codexHome: string, configToml: string): Promise<void> => {
  const cleanup = await writeFile(join(codexHome, "config.toml"), configToml, {
    mode: 0o600,
  }).then(
    () => null,
    (error) => error,
  );
  if (cleanup) {
    logger.debug({ err: String(cleanup) }, "runCodex: failed to scrub isolated config");
  }
};

export const runCodex = async ({
  systemPrompt,
  userPrompt,
  cwd,
  sandbox = "danger-full-access",
  fullAccessConfirmed = true,
  model,
  reasoningEffort,
  speed,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
  onTextDelta,
  connectorInjection,
  signal,
  resumeSessionId,
  onRuntimeEvent,
  executablePath = CODEX_BIN,
  networkAccess = true,
  environment,
  agentControlMode = false,
}: RunCodexOptions): Promise<string> => {
  if (sandbox === "danger-full-access" && !fullAccessConfirmed) {
    throw new Error("Codex danger-full-access requires explicit user confirmation");
  }
  if (sandbox === "danger-full-access" && !networkAccess) {
    throw new Error("Codex cannot enforce network isolation in danger-full-access mode");
  }
  const MAX_INPUT_CHARS = 50_000;
  const truncatedPrompt =
    userPrompt.length > MAX_INPUT_CHARS
      ? `${userPrompt.slice(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`
      : userPrompt;
  const codexMcpConfig = buildCodexMcpConfig(connectorInjection);
  const scrubbedCodexConfig = buildCodexRuntimeConfig("");
  const activeCodexConfig = buildCodexRuntimeConfig(codexMcpConfig.configToml);
  const parsedResumeHandle = resumeSessionId ? decodeResumeHandle(resumeSessionId) : undefined;
  const isManagedResume = Boolean(resumeSessionId?.startsWith(CODEX_RESUME_PREFIX));
  if (isManagedResume && !parsedResumeHandle) {
    throw new Error("invalid ORDINE Codex resume handle");
  }
  if (resumeSessionId && !parsedResumeHandle && hasMcpConnectorInjection(connectorInjection)) {
    throw new Error("legacy Codex session ids cannot be resumed with job-scoped MCP injection");
  }
  const managesCodexHome = !resumeSessionId || Boolean(parsedResumeHandle);
  const isolatedCodexHome = parsedResumeHandle
    ? parsedResumeHandle.codexHome
    : resumeSessionId
      ? (process.env.CODEX_HOME ?? join(homedir(), ".codex"))
      : await createIsolatedCodexHome(activeCodexConfig);
  if (parsedResumeHandle) {
    await writeFile(join(isolatedCodexHome, "config.toml"), activeCodexConfig, {
      mode: 0o600,
    });
  }
  const sessionState = { capturedThreadId: parsedResumeHandle?.threadId };
  const effectiveSandbox = resolveCodexSandbox(sandbox);
  const sandboxArgs = resumeSessionId
    ? ["-c", `sandbox_mode=${JSON.stringify(effectiveSandbox)}`]
    : ["--sandbox", effectiveSandbox];
  if (effectiveSandbox === "workspace-write") {
    sandboxArgs.push("-c", `sandbox_workspace_write.network_access=${networkAccess}`);
  }

  const args = resumeSessionId
    ? ["exec", "resume", "--json", "--skip-git-repo-check", ...sandboxArgs]
    : ["exec", "--json", "--skip-git-repo-check", ...sandboxArgs];

  if (agentControlMode) {
    args.push("--strict-config", "--ignore-rules");
    for (const feature of CODEX_CONTROL_DISABLED_FEATURES) {
      args.push("--disable", feature);
    }
  }
  args.push(
    ...codexOpenDesignShellEnvironmentArgs([
      ...Object.keys(environment ?? {}),
      ...Object.keys(codexMcpConfig.env),
    ]),
  );
  if (!resumeSessionId) {
    args.push("-C", cwd);
  }

  if (model && model !== "default") {
    args.push("--model", model);
  }
  if (reasoningEffort && reasoningEffort !== "default") {
    args.push("-c", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
  }
  if (speed && speed !== "default" && speed !== "standard") {
    args.push("-c", `service_tier=${JSON.stringify(speed)}`);
  }
  if (resumeSessionId) args.push(parsedResumeHandle?.threadId ?? resumeSessionId);

  logger.info({ cwd, requestedSandbox: sandbox, effectiveSandbox }, "runCodex: starting");

  const execution = async (): Promise<string> => {
    await onProgress?.(`[Codex] Starting codex exec (cwd=${cwd}, sandbox=${effectiveSandbox})...`);

    return new Promise<string>((resolve, reject) => {
      const child = spawnCommand(executablePath, args, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ...environment,
          ...codexMcpConfig.env,
          CODEX_HOME: isolatedCodexHome,
        },
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      const completion = { settled: false };
      const jsonEventState = createJsonEventStreamState("codex");
      const runtimeEvents = createRuntimeEventEmitter({
        runtime: "codex",
        onEvent: async (event) => {
          const forwardedEvent =
            event.type === "session"
              ? (() => {
                  sessionState.capturedThreadId = event.id;

                  return {
                    ...event,
                    phase: resumeSessionId ? ("loaded" as const) : event.phase,
                    id: encodeResumeHandle(event.id, isolatedCodexHome),
                  };
                })()
              : event;
          if (event.type === "message" || event.type === "text_delta") {
            await onTextDelta?.(event.text);
          }
          await onRuntimeEvent?.(forwardedEvent);
        },
      });
      runtimeEvents.emit({
        type: "diagnostic",
        level: "info",
        code: "CODEX_EFFECTIVE_SANDBOX",
        message: `Codex sandbox: ${effectiveSandbox}; network request: ${networkAccess ? "enabled" : "disabled"}`,
      });
      if (child.pid) {
        runtimeEvents.emit({
          type: "diagnostic",
          level: "info",
          code: "RUNTIME_PROCESS_STARTED",
          message: `Started Codex with PID ${child.pid}`,
          metadata: { pid: child.pid, executablePath },
        });
      }
      const streamState = {
        lineBuffer: "",
        parsedEventCount: 0,
        emittedAgentMessage: false,
        lastAgentMessage: "",
        delivery: Promise.resolve(),
      };

      const processStreamLine = (line: string) => {
        if (!line.trim()) return;

        handleJsonEventStreamLine(line.trim(), jsonEventState, runtimeEvents.emit);

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

        streamState.emittedAgentMessage = true;
        streamState.lastAgentMessage = event.item.text;
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
        streamState.lineBuffer += chunk.toString("utf8");
        const lines = streamState.lineBuffer.split("\n");
        streamState.lineBuffer = lines.pop() ?? "";
        for (const line of lines) processStreamLine(line);
      });
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      const prompt = systemPrompt
        ? `${systemPrompt}\n\n---\n\n${truncatedPrompt}`
        : truncatedPrompt;
      child.stdin.write(prompt);
      child.stdin.end();

      const emitTerminal = async (
        status: RuntimeTerminalStatus,
        code: number | null,
        message?: string,
      ): Promise<void> => {
        if (message) {
          runtimeEvents.emit({
            type: "diagnostic",
            level: "error",
            code: "CODEX_EXEC_FAILED",
            message,
          });
        }
        runtimeEvents.emit({
          type: "terminal",
          status,
          exitCode: code,
          signal: null,
          resultText: jsonEventState.textParts.join(""),
          sessionId: jsonEventState.sessionId
            ? encodeResumeHandle(jsonEventState.sessionId, isolatedCodexHome)
            : resumeSessionId,
        });
        await runtimeEvents.delivered();
      };

      const abort = (): void => {
        if (completion.settled) return;
        completion.settled = true;
        clearTimeout(timer);
        const message = "codex was cancelled";
        void terminateRuntimeProcess(child).then(
          () => emitTerminal("cancelled", null, message).then(() => reject(new Error(message))),
          (error: unknown) =>
            emitTerminal(
              "failed",
              null,
              error instanceof Error ? error.message : String(error),
            ).then(() => reject(error)),
        );
      };

      const timer = setTimeout(() => {
        if (completion.settled) return;
        completion.settled = true;
        const message = `codex timed out after ${timeoutMs / 1000}s`;
        void terminateRuntimeProcess(child).then(
          () => emitTerminal("timed_out", null, message).then(() => reject(new Error(message))),
          (error: unknown) =>
            emitTerminal(
              "failed",
              null,
              error instanceof Error ? error.message : String(error),
            ).then(() => reject(error)),
        );
      }, timeoutMs);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();

      child.on("error", (error) => {
        if (completion.settled) return;
        completion.settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        logger.error({ err: error.message }, "runCodex: spawn error");
        void onProgress?.(`[Codex] Spawn error: ${error.message}`);
        void emitTerminal("failed", null, error.message).then(() => reject(error));
      });

      const handleCompletion = (code: number | null) => {
        if (completion.settled) return;
        completion.settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        void (async () => {
          processStreamLine(streamState.lineBuffer);
          await streamState.delivery;
          await runtimeEvents.delivered();
          const output =
            jsonEventState.textParts.join("") ||
            streamState.lastAgentMessage ||
            (streamState.parsedEventCount === 0 ? stdout : "");

          if (jsonEventState.fatalMessage) {
            await emitTerminal("failed", code, jsonEventState.fatalMessage);
            reject(new Error(jsonEventState.fatalMessage));

            return;
          }

          if (code !== 0) {
            logger.error({ code, stderr: stderr.slice(0, 500) }, "runCodex: non-zero exit");
            void onProgress?.(`[Codex] Exit code ${code}: ${stderr.slice(0, 200)}`);
            const message = `codex exited with code ${code}: ${stderr.slice(0, 500)}`;
            await emitTerminal("failed", code, message);
            reject(new Error(message));

            return;
          }

          if (stderr) {
            logger.debug({ stderr: stderr.slice(0, 500) }, "runCodex: stderr");
          }

          logger.info({ len: output.length }, "runCodex: complete");
          void onProgress?.(`[Codex] Complete (${output.length} chars)`);
          await emitTerminal("completed", code);
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
    if (!managesCodexHome) return;
    if (sessionState.capturedThreadId) {
      await scrubCodexConfig(isolatedCodexHome, scrubbedCodexConfig);
    } else {
      await cleanupPath(isolatedCodexHome, "isolated home");
    }
  });
};
