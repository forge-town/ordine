import { readFile, unlink } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const CODEX_BIN = process.platform === "win32" ? "codex.cmd" : "codex";

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
      ? `${userPrompt.slice(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`
      : userPrompt;
  const outputFile = join(
    tmpdir(),
    `ordine-codex-last-message-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  );

  const args = [
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

    const child =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", CODEX_BIN, ...args], {
            cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env },
          })
        : spawn(CODEX_BIN, args, {
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
