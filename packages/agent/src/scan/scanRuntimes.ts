import { execFile } from "node:child_process";
import { logger } from "@repo/logger";
import { ResultAsync } from "neverthrow";

export interface DetectedRuntime {
  type: string;
  binaryName: string;
  path: string;
  version?: string;
}

const BUILTIN_RUNTIME_BINARIES: Record<string, string> = {
  "claude-code": "claude",
  codex: "codex",
  hermes: "hermes",
  mastra: "mastra",
  openclaw: "openclaw",
  piagent: "piagent",
};

/**
 * 解析 `ORDINE_EXTRA_RUNTIMES`（形如 `name:bin,name2:bin2`）合并进扫描表，
 * 让任意自定义/新出的 runtime 也能被探测——避免"自动检测"沦为写死白名单（LA-01）。
 * 防御：忽略空段、缺冒号、空 name/bin。
 */
export const parseExtraRuntimes = (raw: string | undefined): Record<string, string> => {
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const name = trimmed.slice(0, colon).trim();
    const bin = trimmed.slice(colon + 1).trim();
    if (!name || !bin) continue;
    result[name] = bin;
  }

  return result;
};

export const getRuntimeBinaries = (
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> => ({
  ...BUILTIN_RUNTIME_BINARIES,
  ...parseExtraRuntimes(env["ORDINE_EXTRA_RUNTIMES"]),
});

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
  const entries = Object.entries(getRuntimeBinaries());
  const results = await Promise.all(
    entries.map(([type, binaryName]) => detectBinary(type, binaryName)),
  );

  return results.filter((r): r is DetectedRuntime => r !== undefined);
};
