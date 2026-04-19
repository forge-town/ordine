import { spawn } from "node:child_process";
import { Result } from "neverthrow";
import { logger } from "@repo/logger";
import { ClaudeStreamEventSchema } from "./schemas/ClaudeStreamEventSchema";
import type { ClaudeStreamEvent } from "./schemas/ClaudeStreamEventSchema";
import type { RunClaudeOptions } from "./schemas/RunClaudeOptionsSchema";
import type { RunClaudeResult } from "./schemas/RunClaudeResultSchema";
import type { ToolName } from "./schemas/ToolNameSchema";

const CLAUDE_BIN = "/Users/amin/.local/bin/claude";

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

/**
 * Extract JSON from text that may contain markdown fences or surrounding prose.
 * Tries: direct parse → fenced code block → first `{...}` substring.
 */
const safeJsonParse = Result.fromThrowable(
  (text: string) => JSON.parse(text) as unknown,
  () => "invalid JSON",
);

export const extractJsonFromText = (text: string): string => {
  const trimmed = text.trim();

  const direct = safeJsonParse(trimmed);
  if (direct.isOk()) return JSON.stringify(direct.value, null, 2);

  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(trimmed);
  if (fenceMatch?.[1]) {
    const fenced = safeJsonParse(fenceMatch[1].trim());
    if (fenced.isOk()) return JSON.stringify(fenced.value, null, 2);
  }

  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = trimmed.substring(braceStart, braceEnd + 1);
    const braced = safeJsonParse(candidate);
    if (braced.isOk()) return JSON.stringify(braced.value, null, 2);
  }

  return trimmed;
};

/**
 * Extract the final text result from stream-json events.
 * Looks at the last `assistant` message's text content blocks.
 */
const extractResultFromEvents = (events: ClaudeStreamEvent[]): string => {
  // Walk events in reverse to find the last assistant message with text
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]!;
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
  timeoutMs = 10 * 60 * 1000,
  maxBudgetUsd = 5,
  onProgress,
}: RunClaudeOptions): Promise<RunClaudeResult> => {
  const MAX_INPUT_CHARS = 50_000;
  const truncatedPrompt =
    userPrompt.length > MAX_INPUT_CHARS
      ? `${userPrompt.substring(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`
      : userPrompt;

  const args = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--system-prompt",
    systemPrompt,
    "--allowedTools",
    allowedTools.join(","),
    "--dangerously-skip-permissions",
    "--no-session-persistence",
    "--max-budget-usd",
    String(maxBudgetUsd),
  ];

  logger.info({ cwd }, "runClaude: starting");
  await onProgress?.(`[Claude] Starting claude -p (cwd=${cwd})...`);

  return new Promise<RunClaudeResult>((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const events: ClaudeStreamEvent[] = [];
    let lineBuf = "";
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      lineBuf += chunk.toString("utf8");
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = safeJsonParse(line);
        if (parsed.isOk()) {
          const validated = ClaudeStreamEventSchema.safeParse(parsed.value);
          if (validated.success) {
            events.push(validated.data);
          } else {
            logger.warn({ line }, "runClaude: unrecognised stream event shape, skipping");
          }
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.stdin.write(truncatedPrompt);
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`claude timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      logger.error({ err: error.message }, "runClaude: spawn error");
      void onProgress?.(`[Claude] Spawn error: ${error.message}`);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      // Flush remaining line buffer
      if (lineBuf.trim()) {
        const parsed = safeJsonParse(lineBuf.trim());
        if (parsed.isOk()) {
          events.push(parsed.value as ClaudeStreamEvent);
        }
      }

      // stream-json may exit with non-zero on budget exceeded but still has valid events
      if (code !== 0 && events.length === 0) {
        logger.error({ code, stderr: stderr.substring(0, 500) }, "runClaude: non-zero exit");
        void onProgress?.(`[Claude] Exit code ${code}: ${stderr.substring(0, 200)}`);
        reject(new Error(`claude exited with code ${code}: ${stderr.substring(0, 500)}`));

        return;
      }

      if (stderr) {
        logger.debug({ stderr: stderr.substring(0, 500) }, "runClaude: stderr");
      }

      // Extract result text from events
      const resultText = extractResultFromEvents(events);

      logger.info({ len: resultText.length, eventCount: events.length }, "runClaude: complete");
      void onProgress?.(`[Claude] Complete (${resultText.length} chars, ${events.length} events)`);
      resolve({ text: resultText, events });
    });
  });
};
