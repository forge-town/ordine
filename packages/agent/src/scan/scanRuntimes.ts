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
  hermes: "hermes",
  mastra: "mastra",
  openclaw: "openclaw",
};

type RuntimeScanPlatform = typeof process.platform;

export const locateBinaryCommand = (platform: RuntimeScanPlatform = process.platform): string =>
  platform === "win32" ? "where.exe" : "which";

export const firstPath = (
  stdout: string,
  platform: RuntimeScanPlatform = process.platform,
): string | undefined => {
  const paths = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (platform === "win32") {
    return paths.find((line) => line.toLowerCase().endsWith(".exe")) ?? paths[0];
  }

  return paths[0];
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
    execFileAsync(locateBinaryCommand(), [binaryName]),
    () => undefined as never,
  );

  if (whichResult.isErr()) {
    return undefined;
  }

  const path = firstPath(whichResult.value.stdout);
  if (!path) {
    return undefined;
  }

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
