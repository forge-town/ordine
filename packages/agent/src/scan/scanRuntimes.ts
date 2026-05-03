import { execFile } from "node:child_process";
import { logger } from "@repo/logger";
import { ResultAsync } from "neverthrow";

export interface DetectedRuntime {
  type: string;
  binaryName: string;
  path: string;
  version?: string;
}

const RUNTIME_BINARIES: Record<string, string> = {
  "claude-code": "claude",
  codex: "codex",
  mastra: "mastra",
  openclaw: "openclaw",
};

const execFileAsync = (bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(bin, args, {}, (error, stdout, stderr) => {
      if (error) {
        reject(error);

        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

const detectBinary = async (
  type: string,
  binaryName: string,
): Promise<DetectedRuntime | undefined> => {
  const whichResult = await ResultAsync.fromPromise(
    execFileAsync("which", [binaryName]),
    () => undefined as never,
  );

  if (whichResult.isErr()) {
    return undefined;
  }

  const path = whichResult.value.stdout.trim();
  logger.info(`Found runtime ${type} at ${path}`);

  const versionResult = await ResultAsync.fromPromise(
    execFileAsync(path, ["--version"]),
    () => undefined as never,
  );
  const version = versionResult.isOk() ? versionResult.value.stdout.trim() || undefined : undefined;

  return { type, binaryName, path, version };
};

export const scanRuntimes = async (): Promise<DetectedRuntime[]> => {
  const entries = Object.entries(RUNTIME_BINARIES);
  const results = await Promise.all(
    entries.map(([type, binaryName]) => detectBinary(type, binaryName)),
  );

  return results.filter((r): r is DetectedRuntime => r !== undefined);
};
