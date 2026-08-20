import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Result, ResultAsync } from "neverthrow";
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
const EMPTY_MCP_CONFIG = JSON.stringify({ mcpServers: {} });

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

const createTemporarySystemPromptFile = async (prompt: string) => {
  const directory = await mkdtemp(join(tmpdir(), "oc-"));
  const filePath = join(directory, "p.txt");

  const writeResult = await ResultAsync.fromPromise(
    writeFile(filePath, prompt, { encoding: "utf8", mode: 0o600 }),
    (error) => error,
  );
  if (writeResult.isErr()) {
    await rm(directory, { recursive: true, force: true });
    throw writeResult.error;
  }

  return {
    filePath,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
};

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
  allowedTools = DEFAULT_READ_ONLY_TOOLS,
  timeoutMs = 20 * 60 * 1000,
  maxBudgetUsd = 5,
  onProgress,
  onTextDelta,
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

  const isSsh = !!ssh;
  const label = isSsh ? `[Claude SSH ${ssh.user}@${ssh.host}]` : "[Claude]";
  const systemPromptFile =
    !isSsh && process.platform === "win32"
      ? await createTemporarySystemPromptFile(sanitizedSystemPrompt)
      : null;

  const claudeArgs = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    ...(systemPromptFile
      ? ["--system-prompt-file", systemPromptFile.filePath]
      : ["--system-prompt", sanitizedSystemPrompt]),
    "--allowedTools",
    effectiveAllowedTools,
    "--mcp-config",
    mcpConfigPath ?? EMPTY_MCP_CONFIG,
    "--strict-mcp-config",
    "--dangerously-skip-permissions",
    "--no-session-persistence",
    "--max-budget-usd",
    String(maxBudgetUsd),
  ];

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
    const { stdout, stderr, stdin } = child;

    if (!stdout || !stderr || !stdin) {
      reject(new Error("claude process stdio streams are unavailable"));

      return;
    }

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
      const textDelta = extractTextDelta(validated.data);
      if (textDelta) void onTextDelta?.(textDelta);
    };

    stdout.on("data", (chunk: Buffer) => {
      streamState.lineBuf += chunk.toString("utf8");
      const lines = streamState.lineBuf.split("\n");
      streamState.lineBuf = lines.pop() ?? "";
      for (const line of lines) processStreamLine(line);
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
      processStreamLine(streamState.lineBuf);

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
  }).finally(async () => {
    await systemPromptFile?.cleanup();
  });
};
