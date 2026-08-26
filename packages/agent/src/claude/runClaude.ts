import { spawn } from "node:child_process";
import { Result } from "neverthrow";
import { logger } from "@repo/logger";
import type { RuntimeTerminalStatus } from "@repo/schemas";
import { createRuntimeEventEmitter } from "../runtime/runtimeEventEmitter";
import { spawnCommand } from "../spawn/spawnCommand";
import { terminateRuntimeProcess } from "../runtime/terminateRuntimeProcess";
import {
  createClaudeRuntimeEventState,
  flushClaudeRuntimeEventState,
  mapClaudeRuntimeEvent,
} from "./mapClaudeRuntimeEvent";
import { ClaudeStreamEventSchema, type ClaudeStreamEvent } from "./schemas/ClaudeStreamEventSchema";
import type { RunClaudeOptions } from "./schemas/RunClaudeOptionsSchema";
import type { RunClaudeResult } from "./schemas/RunClaudeResultSchema";
import type { ToolName } from "./schemas/ToolNameSchema";

const shellEscape = (s: string) => `'${s.replaceAll("'", "'\\\\''")}'`;

const CLAUDE_BIN =
  process.env.CLAUDE_BIN ?? (process.platform === "win32" ? "claude.cmd" : "claude");
const MAX_SYSTEM_PROMPT_CHARS = 10_000;
const UNSAFE_SYSTEM_PROMPT_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const sanitizeSystemPrompt = (value: string) =>
  value.replace(UNSAFE_SYSTEM_PROMPT_CONTROL_CHARS, "").slice(0, MAX_SYSTEM_PROMPT_CHARS);

const DEFAULT_READ_ONLY_TOOLS = [
  "Read",
  "Bash(find:*)",
  "Bash(grep:*)",
  "Bash(rg:*)",
  "Bash(cat:*)",
  "Bash(head:*)",
  "Bash(tail:*)",
  "Bash(wc:*)",
  "Bash(ls:*)",
  "Bash(tree:*)",
] as const satisfies readonly ToolName[];

export const WRITE_TOOLS = [
  ...DEFAULT_READ_ONLY_TOOLS,
  "Edit",
  "Write",
  "Bash(sed:*)",
] as const satisfies readonly ToolName[];

export const READ_ONLY_TOOLS = DEFAULT_READ_ONLY_TOOLS;

export const WEB_TOOLS = [
  ...DEFAULT_READ_ONLY_TOOLS,
  "Bash(curl:*)",
  "Bash(python3:*)",
  "WebSearch",
  "WebFetch",
] as const satisfies readonly ToolName[];

export const GH_TOOLS = [
  ...DEFAULT_READ_ONLY_TOOLS,
  "Bash(gh:*)",
] as const satisfies readonly ToolName[];

const CLAUDE_PERMISSION_MODES = {
  "read-only": "plan",
  "workspace-write": "acceptEdits",
  "full-access": "bypassPermissions",
} as const;

const claudePermissionMode = (
  permissionMode: keyof typeof CLAUDE_PERMISSION_MODES,
  controlMode: boolean,
): string =>
  controlMode && permissionMode === "read-only"
    ? "dontAsk"
    : CLAUDE_PERMISSION_MODES[permissionMode];

const isReadOnlyTool = (tool: string, networkAccess: boolean): boolean =>
  tool.startsWith("mcp__") ||
  READ_ONLY_TOOLS.includes(tool as (typeof READ_ONLY_TOOLS)[number]) ||
  (networkAccess && (tool === "WebSearch" || tool === "WebFetch" || tool === "Bash(curl:*)"));

export const buildClaudePermissionArgs = ({
  permissionMode,
  allowedTools,
  mcpToolNames,
  networkAccess,
  controlMode = false,
}: {
  permissionMode: keyof typeof CLAUDE_PERMISSION_MODES;
  allowedTools: readonly string[] | undefined;
  mcpToolNames: readonly string[] | undefined;
  networkAccess: boolean;
  controlMode?: boolean;
}): string[] => {
  const toolSelectionWasProvided = allowedTools !== undefined || mcpToolNames !== undefined;
  const requestedTools = [...new Set([...(allowedTools ?? []), ...(mcpToolNames ?? [])])];
  const hasExplicitToolSelection =
    requestedTools.length > 0 || (permissionMode !== "full-access" && toolSelectionWasProvided);
  const effectiveTools = requestedTools.filter(
    (tool) =>
      (permissionMode !== "read-only" || isReadOnlyTool(tool, networkAccess)) &&
      (networkAccess || !["WebSearch", "WebFetch", "Bash(curl:*)"].includes(tool)),
  );
  const args = ["--permission-mode", claudePermissionMode(permissionMode, controlMode)];
  if (hasExplicitToolSelection) {
    const toolList = effectiveTools.join(",");
    args.push("--tools", toolList);
    if (toolList) args.push("--allowedTools", toolList);
  }
  const deniedTools = [
    ...(permissionMode === "read-only" ? ["Edit", "Write"] : []),
    ...(networkAccess ? [] : ["WebSearch", "WebFetch", "Bash(curl:*)", "Bash(wget:*)"]),
  ];
  if (deniedTools.length > 0) args.push("--disallowedTools", deniedTools.join(","));

  return args;
};

const safeJsonParse = Result.fromThrowable(
  (text: string) => JSON.parse(text) as unknown,
  () => "invalid JSON",
);

const extractTextDelta = (event: ClaudeStreamEvent): string | undefined => {
  if (event.type !== "stream_event") return undefined;

  const streamEvent = event.event;
  if (
    streamEvent?.type !== "content_block_delta" ||
    streamEvent.delta?.type !== "text_delta" ||
    typeof streamEvent.delta.text !== "string" ||
    streamEvent.delta.text.length === 0
  ) {
    return undefined;
  }

  return streamEvent.delta.text;
};

/**
 * Extract the final text result from stream-json events.
 * Looks at the last `assistant` message's text content blocks.
 */
const extractResultFromEvents = (events: ClaudeStreamEvent[]): string => {
  // Walk events in reverse to find the last assistant message with text
  for (const ev of [...events].reverse()) {
    if (ev.type === "assistant" && ev.message?.content) {
      const textBlocks = ev.message.content.filter(
        (c): c is { type: "text"; text: string } => c.type === "text" && "text" in c,
      );
      if (textBlocks.length > 0) {
        return textBlocks.map((b) => b.text).join("\n");
      }
    }
    if (ev.type === "result" && typeof ev.result === "string") {
      return ev.result;
    }
  }

  return "";
};

/**
 * Pure Claude CLI driver. Spawns `claude -p` with the given system prompt,
 * user prompt, and tool permissions. Returns the raw text output plus all
 * stream events for observability.
 *
 * No knowledge of skills, modes, or output schemas — that belongs in the caller.
 */
export const runClaude = async ({
  systemPrompt,
  userPrompt,
  cwd,
  model,
  reasoningEffort,
  speed,
  allowedTools,
  executablePath = CLAUDE_BIN,
  timeoutMs = 20 * 60 * 1000,
  onProgress,
  onTextDelta,
  onRuntimeEvent,
  signal,
  permissionMode = "full-access",
  fullAccessConfirmed = true,
  networkAccess = true,
  supportsPartialMessages = false,
  supportsReasoningEffort = false,
  resumeSessionId,
  sessionId = crypto.randomUUID(),
  extraEnv,
  ssh,
  mcpConfigPath,
  mcpToolNames,
}: RunClaudeOptions): Promise<RunClaudeResult> => {
  if (permissionMode === "full-access" && !fullAccessConfirmed) {
    throw new Error("Claude Code full-access requires explicit user confirmation");
  }
  if (reasoningEffort && reasoningEffort !== "default" && !supportsReasoningEffort) {
    throw new Error("Installed Claude Code CLI does not advertise --effort");
  }
  if (speed && speed !== "default" && speed !== "standard") {
    throw new Error("Installed Claude Code CLI does not advertise a headless speed option");
  }
  const MAX_INPUT_CHARS = 50_000;
  const sanitizedSystemPrompt = sanitizeSystemPrompt(systemPrompt);
  const truncatedPrompt =
    userPrompt.length > MAX_INPUT_CHARS
      ? `${userPrompt.slice(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`
      : userPrompt;

  const isSsh = !!ssh;
  const label = isSsh ? `[Claude SSH ${ssh.user}@${ssh.host}]` : "[Claude]";
  const composedPrompt = sanitizedSystemPrompt
    ? `${sanitizedSystemPrompt}\n\n---\n\n${truncatedPrompt}`
    : truncatedPrompt;
  const agentControlMode = extraEnv?.ORDINE_AGENT_CONTROL_MODE === "1";

  const claudeArgs = [
    "-p",
    "--verbose",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    ...(supportsPartialMessages ? ["--include-partial-messages"] : []),
    ...(model && model !== "default" ? ["--model", model] : []),
    ...(reasoningEffort && reasoningEffort !== "default" ? ["--effort", reasoningEffort] : []),
    ...(agentControlMode ? ["--disable-slash-commands"] : []),
    ...(mcpConfigPath ? ["--mcp-config", mcpConfigPath] : []),
    ...(agentControlMode && mcpConfigPath ? ["--strict-mcp-config"] : []),
    ...buildClaudePermissionArgs({
      permissionMode,
      allowedTools,
      mcpToolNames,
      networkAccess,
      controlMode: agentControlMode,
    }),
    ...(resumeSessionId ? ["--resume", resumeSessionId] : ["--session-id", sessionId]),
  ];

  logger.info({ cwd, ssh: isSsh ? `${ssh?.user}@${ssh?.host}` : "local" }, "runClaude: starting");
  const runtimeEvents = createRuntimeEventEmitter({
    runtime: "claude-code",
    onEvent: onRuntimeEvent,
  });
  const runtimeState = createClaudeRuntimeEventState();
  runtimeEvents.emit({ type: "status", phase: "starting", message: "Starting Claude Code" });
  runtimeEvents.emit({
    type: "diagnostic",
    level: "info",
    code: "CLAUDE_EFFECTIVE_PERMISSION_MODE",
    message: `Claude Code permission mode: ${claudePermissionMode(permissionMode, agentControlMode)}; filesystem/network restrictions are CLI policy best-effort (${networkAccess ? "network allowed" : "network tools denied"})`,
  });
  await onProgress?.(`${label} Starting claude -p (cwd=${cwd})...`);

  return new Promise<RunClaudeResult>((resolve, reject) => {
    const child = (() => {
      if (ssh) {
        const sshArgs: string[] = [];
        if (ssh.keyPath) sshArgs.push("-i", ssh.keyPath);
        if (ssh.port) sshArgs.push("-p", String(ssh.port));
        sshArgs.push("-o", "StrictHostKeyChecking=accept-new");
        sshArgs.push(`${ssh.user}@${ssh.host}`);

        const remoteCmd = `cd ${shellEscape(cwd)} && claude ${claudeArgs.map(shellEscape).join(" ")}`;
        sshArgs.push(remoteCmd);

        return spawn("ssh", sshArgs, {
          stdio: ["pipe", "pipe", "pipe"],
          env: extraEnv ? { ...process.env, ...extraEnv } : undefined,
        });
      }

      return spawnCommand(executablePath, claudeArgs, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: extraEnv ? { ...process.env, ...extraEnv } : undefined,
      });
    })();

    const events: ClaudeStreamEvent[] = [];
    const streamState = { lineBuf: "" };
    const stderrChunks: Buffer[] = [];
    const lifecycle = { settled: false };
    const { stdout, stderr, stdin } = child;
    if (child.pid) {
      runtimeEvents.emit({
        type: "diagnostic",
        level: "info",
        code: "RUNTIME_PROCESS_STARTED",
        message: `Started Claude Code with PID ${child.pid}`,
        metadata: { pid: child.pid, executablePath },
      });
    }

    const finishRuntime = async ({
      status,
      exitCode,
      resultText,
      message,
    }: {
      status: RuntimeTerminalStatus;
      exitCode: number | null;
      resultText: string;
      message?: string;
    }): Promise<void> => {
      flushClaudeRuntimeEventState(runtimeState, runtimeEvents.emit);
      if (message) {
        runtimeEvents.emit({
          type: "diagnostic",
          level: "error",
          code: "CLAUDE_EXEC_FAILED",
          message,
        });
      }
      runtimeEvents.emit({
        type: "terminal",
        status,
        exitCode,
        signal: null,
        resultText,
        sessionId: runtimeState.sessionId,
      });
      await runtimeEvents.delivered();
    };

    if (!stdout || !stderr || !stdin) {
      lifecycle.settled = true;
      const error = new Error("claude process stdio streams are unavailable");
      void finishRuntime({
        status: "failed",
        exitCode: null,
        resultText: "",
        message: error.message,
      }).then(() => reject(error));

      return;
    }

    const stdinState = { closed: false };
    const closeStdin = (): void => {
      if (stdinState.closed) return;
      stdinState.closed = true;
      stdin.end();
    };

    const processStreamLine = (line: string) => {
      if (!line.trim()) return;

      const parsed = safeJsonParse(line.trim());
      if (!parsed.isOk()) return;

      const validated = ClaudeStreamEventSchema.safeParse(parsed.value);
      if (!validated.success) {
        logger.warn({ line }, "runClaude: unrecognised stream event shape, skipping");

        return;
      }

      events.push(validated.data);
      mapClaudeRuntimeEvent(validated.data, runtimeState, runtimeEvents.emit);
      const textDelta = extractTextDelta(validated.data);
      if (textDelta) void onTextDelta?.(textDelta);
      const stopReason = validated.data.message?.stop_reason;
      if (
        validated.data.type === "result" ||
        (validated.data.type === "assistant" &&
          validated.data.parent_tool_use_id == null &&
          stopReason &&
          stopReason !== "tool_use")
      ) {
        closeStdin();
      }
    };

    stdout.on("data", (chunk: Buffer) => {
      streamState.lineBuf += chunk.toString("utf8");
      const lines = streamState.lineBuf.split("\n");
      streamState.lineBuf = lines.pop() ?? "";
      for (const line of lines) processStreamLine(line);
    });

    stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    // Each Agent Run is a single headless turn. Closing stdin after the one
    // stream-json user message lets Claude finish the turn after any MCP calls;
    // leaving it open makes the CLI wait indefinitely for another user message.
    stdinState.closed = true;
    stdin.end(
      `${JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: composedPrompt }],
        },
      })}\n`,
    );

    const abort = () => {
      if (lifecycle.settled) return;
      lifecycle.settled = true;
      clearTimeout(timer);
      const message = "claude was cancelled";
      void terminateRuntimeProcess(child).then(
        () =>
          finishRuntime({
            status: "cancelled",
            exitCode: null,
            resultText: extractResultFromEvents(events),
            message,
          }).then(() => reject(new Error(message))),
        (error: unknown) =>
          finishRuntime({
            status: "failed",
            exitCode: null,
            resultText: extractResultFromEvents(events),
            message: error instanceof Error ? error.message : String(error),
          }).then(() => reject(error)),
      );
    };

    const timer = setTimeout(() => {
      if (lifecycle.settled) return;
      lifecycle.settled = true;
      const message = `claude timed out after ${timeoutMs / 1000}s`;
      void terminateRuntimeProcess(child).then(
        () =>
          finishRuntime({
            status: "timed_out",
            exitCode: null,
            resultText: extractResultFromEvents(events),
            message,
          }).then(() => reject(new Error(message))),
        (error: unknown) =>
          finishRuntime({
            status: "failed",
            exitCode: null,
            resultText: extractResultFromEvents(events),
            message: error instanceof Error ? error.message : String(error),
          }).then(() => reject(error)),
      );
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();

    child.on("error", (error) => {
      if (lifecycle.settled) return;
      lifecycle.settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      logger.error({ err: error.message }, "runClaude: spawn error");
      void onProgress?.(`${label} Spawn error: ${error.message}`);
      void finishRuntime({
        status: "failed",
        exitCode: null,
        resultText: extractResultFromEvents(events),
        message: error.message,
      }).then(() => reject(error));
    });

    child.on("close", (code) => {
      if (lifecycle.settled) return;
      lifecycle.settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      // Flush remaining line buffer
      processStreamLine(streamState.lineBuf);

      if (code !== 0) {
        logger.error({ code, stderr: stderr.slice(0, 500) }, "runClaude: non-zero exit");
        void onProgress?.(`${label} Exit code ${code}: ${stderr.slice(0, 200)}`);
        const message = `claude exited with code ${code}: ${stderr.slice(0, 500)}`;
        void finishRuntime({
          status: "failed",
          exitCode: code,
          resultText: extractResultFromEvents(events),
          message,
        }).then(() => reject(new Error(message)));

        return;
      }

      if (stderr) {
        logger.debug({ stderr: stderr.slice(0, 500) }, "runClaude: stderr");
      }

      // Extract result text from events
      const resultText = extractResultFromEvents(events);

      logger.info({ len: resultText.length, eventCount: events.length }, "runClaude: complete");
      void onProgress?.(`${label} Complete (${resultText.length} chars, ${events.length} events)`);
      void finishRuntime({
        status: "completed",
        exitCode: code,
        resultText,
      }).then(() => resolve({ text: resultText, events }));
    });
  });
};
