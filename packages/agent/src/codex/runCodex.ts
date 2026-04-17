import { spawn } from "node:child_process";
import { logger } from "@repo/logger";

export interface RunCodexOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  model?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void>;
}

const CODEX_BIN = "codex";

export const CODEX_SANDBOX_MODES = {
  readOnly: "read-only",
  workspaceWrite: "workspace-write",
  fullAccess: "danger-full-access",
} as const;

export const runCodex = async ({
  systemPrompt,
  userPrompt,
  cwd,
  sandbox = "read-only",
  model,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunCodexOptions): Promise<string> => {
  const MAX_INPUT_CHARS = 50_000;
  const truncatedPrompt =
    userPrompt.length > MAX_INPUT_CHARS
      ? `${userPrompt.substring(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`
      : userPrompt;

  const args = ["exec", "--sandbox", sandbox, "--ephemeral", "--skip-git-repo-check", "-C", cwd];

  if (model) {
    args.push("--model", model);
  }

  logger.info({ cwd, sandbox }, "runCodex: starting");
  await onProgress?.(`[Codex] Starting codex exec (cwd=${cwd}, sandbox=${sandbox})...`);

  return new Promise<string>((resolve, reject) => {
    const child = spawn(CODEX_BIN, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
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
      reject(new Error(`codex timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      logger.error({ err: error.message }, "runCodex: spawn error");
      void onProgress?.(`[Codex] Spawn error: ${error.message}`);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (code !== 0) {
        logger.error({ code, stderr: stderr.substring(0, 500) }, "runCodex: non-zero exit");
        void onProgress?.(`[Codex] Exit code ${code}: ${stderr.substring(0, 200)}`);
        reject(new Error(`codex exited with code ${code}: ${stderr.substring(0, 500)}`));

        return;
      }

      if (stderr) {
        logger.debug({ stderr: stderr.substring(0, 500) }, "runCodex: stderr");
      }

      logger.info({ len: stdout.length }, "runCodex: complete");
      void onProgress?.(`[Codex] Complete (${stdout.length} chars)`);
      resolve(stdout);
    });
  });
};
