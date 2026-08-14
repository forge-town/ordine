import { spawn } from "node:child_process";
import { Result } from "neverthrow";
import { logger } from "@repo/logger";
import { spawnCommand } from "../spawn/spawnCommand";
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

const safeJsonParse = Result.fromThrowable(
  (text: string) => JSON.parse(text) as unknown,
  () => "invalid JSON",
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const extractTextDelta = (event: ClaudeStreamEvent): string | null => {
  if (event.type !== "stream_event" || !isRecord(event.event)) return null;
  if (event.event.type !== "content_block_delta" || !isRecord(event.event.delta)) return null;

  return event.event.delta.type === "text_delta" && typeof event.event.delta.text === "string"
    ? event.event.delta.text
    : null;
};

const extractAssistantText = (event: ClaudeStreamEvent): string =>
  event.type === "assistant" && event.message?.content
    ? event.message.content
        .filter(
          (block): block is { type: "text"; text: string } =>
            block.type === "text" && "text" in block,
        )
        .map((block) => block.text)
        .join("\n")
    : "";

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
  allowedTools = DEFAULT_READ_ONLY_TOOLS,
  timeoutMs = 20 * 60 * 1000,
  maxBudgetUsd = 5,
  onProgress,
  onAssistantChunk,
  extraEnv,
  ssh,
  mcpConfigPath,
  mcpToolNames,
}: RunClaudeOptions): Promise<RunClaudeResult> => {
  const MAX_INPUT_CHARS = 50_000;
  const sanitizedSystemPrompt = sanitizeSystemPrompt(systemPrompt);
  const truncatedPrompt =
    userPrompt.length > MAX_INPUT_CHARS
      ? `${userPrompt.slice(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`
      : userPrompt;

  // Connector tool names (mcp__server__tool) are merged with the built-in allowedTools.
  const effectiveAllowedTools = [...allowedTools, ...(mcpToolNames ?? [])].join(",");

  const claudeArgs = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--system-prompt",
    sanitizedSystemPrompt,
    "--allowedTools",
    effectiveAllowedTools,
    ...(mcpConfigPath ? ["--mcp-config", mcpConfigPath] : []),
    "--dangerously-skip-permissions",
    "--no-session-persistence",
    "--max-budget-usd",
    String(maxBudgetUsd),
  ];

  const isSsh = !!ssh;
  const label = isSsh ? `[Claude SSH ${ssh.user}@${ssh.host}]` : "[Claude]";

  logger.info({ cwd, ssh: isSsh ? `${ssh?.user}@${ssh?.host}` : "local" }, "runClaude: starting");
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

      return spawnCommand(CLAUDE_BIN, claudeArgs, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: extraEnv ? { ...process.env, ...extraEnv } : undefined,
      });
    })();

    const events: ClaudeStreamEvent[] = [];
    const streamState = { lineBuf: "" };
    const stderrChunks: Buffer[] = [];
    const partialMessages = { seen: false };
    const { stdout, stderr, stdin } = child;

    if (!stdout || !stderr || !stdin) {
      reject(new Error("claude process stdio streams are unavailable"));

      return;
    }

    const handleStreamEvent = (event: ClaudeStreamEvent): void => {
      events.push(event);
      const textDelta = extractTextDelta(event);
      if (textDelta !== null) {
        partialMessages.seen = true;
        void onAssistantChunk?.(textDelta);
        return;
      }

      if (partialMessages.seen) return;
      const assistantText = extractAssistantText(event);
      if (assistantText) void onAssistantChunk?.(assistantText);
    };

    const parseStreamLine = (line: string): void => {
      if (!line.trim()) return;
      const parsed = safeJsonParse(line);
      if (parsed.isErr()) return;
      const validated = ClaudeStreamEventSchema.safeParse(parsed.value);
      if (!validated.success) {
        logger.warn({ line }, "runClaude: unrecognised stream event shape, skipping");
        return;
      }

      handleStreamEvent(validated.data);
    };

    stdout.on("data", (chunk: Buffer) => {
      streamState.lineBuf += chunk.toString("utf8");
      const lines = streamState.lineBuf.split("\n");
      streamState.lineBuf = lines.pop() ?? "";
      for (const line of lines) {
        parseStreamLine(line);
      }
    });

    stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    stdin.write(truncatedPrompt);
    stdin.end();

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`claude timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      logger.error({ err: error.message }, "runClaude: spawn error");
      void onProgress?.(`${label} Spawn error: ${error.message}`);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      // Flush remaining line buffer
      if (streamState.lineBuf.trim()) {
        parseStreamLine(streamState.lineBuf.trim());
      }

      // stream-json may exit with non-zero on budget exceeded but still has valid events
      if (code !== 0 && events.length === 0) {
        logger.error({ code, stderr: stderr.slice(0, 500) }, "runClaude: non-zero exit");
        void onProgress?.(`${label} Exit code ${code}: ${stderr.slice(0, 200)}`);
        reject(new Error(`claude exited with code ${code}: ${stderr.slice(0, 500)}`));

        return;
      }

      if (stderr) {
        logger.debug({ stderr: stderr.slice(0, 500) }, "runClaude: stderr");
      }

      // Extract result text from events
      const resultText = extractResultFromEvents(events);

      logger.info({ len: resultText.length, eventCount: events.length }, "runClaude: complete");
      void onProgress?.(`${label} Complete (${resultText.length} chars, ${events.length} events)`);
      resolve({ text: resultText, events });
    });
  });
};
