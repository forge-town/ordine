import { logger } from "@repo/logger";
import { err, ok, type Result } from "neverthrow";
import { spawnCommand } from "./spawnCommand";

export interface RunCliToCompletionOptions {
  /** Binary name, resolved via PATH (e.g. "pi", "opencode"). */
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  /** Human label for logs and progress lines (e.g. "Pi", "Opencode"). */
  label: string;
  onProgress?: (line: string) => Promise<void> | void;
}

/**
 * Run a CLI to completion and resolve with its full stdout.
 *
 * Uses spawn (not execFile) with `detached` on POSIX: several agent CLIs
 * (pi, opencode) only exit cleanly when they lead their own process group —
 * spawned non-detached they finish the work, print the answer, then linger
 * until the timeout kill. `spawnCommand` keeps the Windows .cmd-shim handling
 * in one place.
 */
export const runCliToCompletion = ({
  command,
  args,
  cwd,
  timeoutMs,
  label,
  onProgress,
}: RunCliToCompletionOptions): Promise<Result<string, Error>> =>
  new Promise((resolve) => {
    const child = spawnCommand(command, args, {
      cwd,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d: Buffer) => errChunks.push(d));
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      const errMsg = `${command} failed to start: ${error.message}`;
      logger.error({ command, err: error.message }, "runCliToCompletion: spawn error");
      void onProgress?.(`[${label}] Error: ${errMsg.slice(0, 200)}`);
      resolve(err(new Error(errMsg)));
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const text = Buffer.concat(chunks).toString("utf8");
      const stderrText = Buffer.concat(errChunks).toString("utf8").trim();

      if (code !== 0 || signal) {
        const diagnostic = stderrText || (signal ? `killed by ${signal}` : "unknown error");
        const errMsg = `${command} exited with code ${code ?? signal}: ${diagnostic}`;
        logger.error(
          { command, code, signal, stderr: stderrText.slice(0, 500) },
          "runCliToCompletion: non-zero exit",
        );
        void onProgress?.(`[${label}] Error: ${errMsg.slice(0, 200)}`);
        resolve(err(new Error(errMsg)));

        return;
      }

      if (text.trim().length === 0) {
        logger.error({ command, stderr: stderrText.slice(0, 500) }, "runCliToCompletion: empty output");
        void onProgress?.(`[${label}] Empty output`);
        resolve(err(new Error(`${command} returned empty output`)));

        return;
      }

      logger.info({ command, len: text.length }, "runCliToCompletion: complete");
      void onProgress?.(`[${label}] Complete (${text.length} chars)`);
      resolve(ok(text));
    });
  });
