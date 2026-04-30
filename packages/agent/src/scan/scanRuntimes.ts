import { execFile } from "node:child_process";
import { logger } from "@repo/logger";

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
  const whichResult = await execFileAsync("which", [binaryName]).catch(() => undefined);

  if (!whichResult) {
    return undefined;
  }

  const path = whichResult.stdout.trim();
  logger.info(`Found runtime ${type} at ${path}`);

  const versionResult = await execFileAsync(path, ["--version"]).catch(() => undefined);
  const version = versionResult?.stdout.trim() || undefined;

  return { type, binaryName, path, version };
};

export const scanRuntimes = async (): Promise<DetectedRuntime[]> => {
  const entries = Object.entries(RUNTIME_BINARIES);
  const results = await Promise.all(
    entries.map(([type, binaryName]) => detectBinary(type, binaryName)),
  );

  return results.filter((r): r is DetectedRuntime => r !== undefined);
};
