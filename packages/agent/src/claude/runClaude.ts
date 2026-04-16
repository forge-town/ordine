import { spawn } from "node:child_process";
import { Result } from "neverthrow";
import { logger } from "../logger";

export interface RunClaudeOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  allowedTools?: string[];
  timeoutMs?: number;
  maxBudgetUsd?: number;
  onProgress?: (line: string) => Promise<void>;
}

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
];

export const WRITE_TOOLS = [...DEFAULT_READ_ONLY_TOOLS, "Edit", "Write", "Bash(sed:*)"];

export const READ_ONLY_TOOLS = DEFAULT_READ_ONLY_TOOLS;

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
 * Pure Claude CLI driver. Spawns `claude -p` with the given system prompt,
 * user prompt, and tool permissions. Returns the raw text output.
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
}: RunClaudeOptions): Promise<string> => {
  const MAX_INPUT_CHARS = 50_000;
  const truncatedPrompt =
    userPrompt.length > MAX_INPUT_CHARS
      ? `${userPrompt.substring(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`
      : userPrompt;

  const args = [
    "-p",
    "--bare",
    "--output-format",
    "json",
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

  return new Promise<string>((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
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
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (code !== 0) {
        logger.error({ code, stderr: stderr.substring(0, 500) }, "runClaude: non-zero exit");
        void onProgress?.(`[Claude] Exit code ${code}: ${stderr.substring(0, 200)}`);
        reject(new Error(`claude exited with code ${code}: ${stderr.substring(0, 500)}`));
        return;
      }

      if (stderr) {
        logger.debug({ stderr: stderr.substring(0, 500) }, "runClaude: stderr");
      }

      // Parse the Claude CLI JSON envelope to extract the result text
      const parsedResult = safeJsonParse(stdout);
      if (parsedResult.isErr()) {
        logger.warn({ len: stdout.length }, "runClaude: non-JSON output, returning raw");
        void onProgress?.(`[Claude] Non-JSON output (${stdout.length} chars)`);
        resolve(stdout);
        return;
      }

      const parsed = parsedResult.value as Record<string, unknown>;
      const resultText: string =
        typeof parsed.result === "string"
          ? parsed.result
          : typeof parsed.content === "string"
            ? (parsed.content as string)
            : stdout;

      logger.info({ len: resultText.length }, "runClaude: complete");
      void onProgress?.(`[Claude] Complete (${resultText.length} chars)`);
      resolve(resultText);
    });
  });
};
