import { spawn } from "node:child_process";
import { logger } from "../logger";
import { CheckOutputSchema, CHECK_OUTPUT_EXAMPLE } from "../schemas/CheckOutputSchema";
import { FixOutputSchema, FIX_OUTPUT_EXAMPLE } from "../schemas/FixOutputSchema";

export interface RunClaudeOptions {
  skillId: string;
  skillDescription: string;
  inputContent: string;
  projectRoot: string;
  writeEnabled?: boolean;
  onProgress?: (line: string) => Promise<void>;
}

const CLAUDE_BIN = "/Users/amin/.local/bin/claude";

const buildSystemPrompt = (
  skillId: string,
  skillDescription: string,
  mode: "check" | "fix",
): string => {
  const example = mode === "check" ? CHECK_OUTPUT_EXAMPLE : FIX_OUTPUT_EXAMPLE;
  const lines = [
    `You are an expert code analysis agent executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    `Mode: ${mode}`,
    "",
    "Use the tools available to you (Read, Bash, etc.) to explore the project.",
    "Examine actual source code before making conclusions.",
    "",
    mode === "check"
      ? "Your task is to CHECK the code and report findings."
      : "Your task is to FIX violations in the code and report what you changed.",
    "",
    "Output ONLY a JSON object matching this exact structure (no markdown fences, no extra text):",
    JSON.stringify(example, null, 2),
    "",
    "Your final message MUST be this JSON object and nothing else.",
  ];
  return lines.join("\n");
};

const READ_ONLY_TOOLS = [
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

const WRITE_TOOLS = [...READ_ONLY_TOOLS, "Edit", "Write", "Bash(sed:*)"];

/**
 * Extract JSON from text that may contain markdown fences or surrounding prose.
 * Tries: direct parse → fenced code block → first `{...}` substring.
 */
const extractJsonFromText = (text: string): string => {
  const trimmed = text.trim();

  // 1. Direct JSON parse
  try {
    const obj = JSON.parse(trimmed);
    return JSON.stringify(obj, null, 2);
  } catch {
    /* continue */
  }

  // 2. Fenced code block: ```json ... ``` or ``` ... ```
  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(trimmed);
  if (fenceMatch?.[1]) {
    try {
      const obj = JSON.parse(fenceMatch[1].trim());
      return JSON.stringify(obj, null, 2);
    } catch {
      /* continue */
    }
  }

  // 3. Find first { ... } substring (greedy last })
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = trimmed.substring(braceStart, braceEnd + 1);
    try {
      const obj = JSON.parse(candidate);
      return JSON.stringify(obj, null, 2);
    } catch {
      /* continue */
    }
  }

  // 4. Return as-is
  return trimmed;
};

export const runClaude = async ({
  skillId,
  skillDescription,
  inputContent,
  projectRoot,
  writeEnabled = false,
  onProgress,
}: RunClaudeOptions): Promise<string> => {
  const mode = writeEnabled ? "fix" : "check";
  const systemPrompt = buildSystemPrompt(skillId, skillDescription, mode);
  const allowedTools = writeEnabled ? WRITE_TOOLS : READ_ONLY_TOOLS;

  const userPrompt = `Project path: ${projectRoot}\n\nInput:\n${inputContent}`;

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
    "1",
  ];

  logger.info({ skillId, mode, projectRoot }, "runClaude: starting");
  await onProgress?.(`[Claude] Starting claude -p for skill ${skillId} (${mode} mode)...`);

  return new Promise<string>((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.stdin.write(userPrompt);
    child.stdin.end();

    const timer = setTimeout(
      () => {
        child.kill("SIGTERM");
        reject(new Error("claude timed out after 10 minutes"));
      },
      10 * 60 * 1000,
    );

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

      try {
        const parsed = JSON.parse(stdout);
        const resultText: string =
          typeof parsed.result === "string"
            ? parsed.result
            : typeof parsed.content === "string"
              ? parsed.content
              : stdout;

        const reportJson = extractJsonFromText(resultText);
        const schema = mode === "check" ? CheckOutputSchema : FixOutputSchema;
        const validation = schema.safeParse(JSON.parse(reportJson));
        if (validation.success) {
          logger.info({ len: reportJson.length }, "runClaude: valid report");
          void onProgress?.(`[Claude] Valid ${mode} report (${reportJson.length} chars)`);
          resolve(reportJson);
        } else {
          logger.warn({ errors: validation.error }, "runClaude: schema validation failed");
          void onProgress?.("[Claude] Schema validation warning, using raw output");
          resolve(reportJson);
        }
      } catch {
        logger.warn({ len: stdout.length }, "runClaude: non-JSON output, returning raw");
        void onProgress?.(`[Claude] Non-JSON output (${stdout.length} chars)`);
        resolve(stdout);
      }
    });
  });
};
