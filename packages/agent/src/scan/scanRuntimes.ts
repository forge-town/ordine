import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { logger } from "@repo/logger";
import { AgentRuntimeSchema, type DetectedRuntime } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { probeRuntimeModels } from "./probeRuntimeModels";
import { getRuntimeManifest } from "../runtime/runtimeManifestRegistry";

const BUILTIN_RUNTIME_BINARIES: Record<string, string> = {
  "claude-code": "claude",
  codex: "codex",
  "deepseek-harness": "dsh",
  hermes: "hermes",
  mastra: "mastra",
  "mistral-vibe": "vibe-acp",
  openclaw: "openclaw",
  "pi-agent": "pi",
  opencode: "opencode",
  "kimi-code": "kimi",
  "deepseek-reasonix": "reasonix",
  kiro: "kiro-cli",
  trae: "traecli",
};

/**
 * Parse `ORDINE_EXTRA_RUNTIMES` (shaped like `name:bin,name2:bin2`) into a
 * name→binary map. Pure parser — shape only, no policy; the caller decides which
 * names are allowed. Defensive: ignores empty segments, missing colons, and
 * empty name/bin.
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

/**
 * Scan catalog = builtin runtimes, with `ORDINE_EXTRA_RUNTIMES` allowed to
 * OVERRIDE the binary name of a known runtime or REGISTER a binary for any
 * type in `AgentRuntimeSchema` that is not in the builtin list (e.g. a renamed
 * CLI, or a type whose binary lives outside PATH conventions). Names outside
 * the schema enum are still ignored: persistence, driver dispatch, and UI all
 * key off the enum, so a truly unknown type would only produce a runtime the
 * rest of the stack rejects as unsupported.
 */
export const getRuntimeBinaries = (
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> => {
  const binaries: Record<string, string> = { ...BUILTIN_RUNTIME_BINARIES };
  for (const [name, bin] of Object.entries(parseExtraRuntimes(env["ORDINE_EXTRA_RUNTIMES"]))) {
    if (AgentRuntimeSchema.safeParse(name).success) {
      binaries[name] = bin;
    } else {
      logger.warn(
        { runtime: name },
        "ORDINE_EXTRA_RUNTIMES: ignoring unknown runtime; only types in AgentRuntimeSchema are supported",
      );
    }
  }

  return binaries;
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
    // `where.exe` already returns matches in PATH resolution order. Preserve
    // that order while skipping extensionless npm shell scripts that cannot be
    // spawned directly on Windows. Globally preferring `.exe` can otherwise
    // select an inaccessible Microsoft Store package over an earlier, working
    // npm `.cmd` shim.
    return paths.find((line) => /\.(?:exe|cmd|bat)$/i.test(line)) ?? paths[0];
  }

  return paths[0];
};

export const versionCommand = (
  path: string,
  platform: RuntimeScanPlatform = process.platform,
): { bin: string; args: string[] } =>
  platform === "win32" && /\.(?:cmd|bat)$/i.test(path)
    ? { bin: "cmd.exe", args: ["/d", "/s", "/c", path, "--version"] }
    : { bin: path, args: ["--version"] };

const execFileAsync = (bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { cwd: tmpdir(), timeout: 10_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);

        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/**
 * Directories where agent CLIs are commonly installed but which are often
 * missing from the PATH of a daemon or desktop-launched process.
 * Probed only when `which` fails.
 */
const FALLBACK_BINARY_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "~/.local/bin",
  "~/.npm-global/bin",
  "~/.bun/bin",
];

const isExecutable = (path: string): Promise<boolean> =>
  access(path, constants.X_OK).then(
    () => true,
    () => false,
  );

const probeFallbackDirs = async (binaryName: string): Promise<string | undefined> => {
  const candidates = FALLBACK_BINARY_DIRS.map((dir) =>
    join(dir.replace(/^~/, homedir()), binaryName),
  );
  const hits = await Promise.all(
    candidates.map(async (candidate) => ({ candidate, ok: await isExecutable(candidate) })),
  );

  return hits.find((hit) => hit.ok)?.candidate;
};

const resolveBinaryPath = async (binaryName: string): Promise<string | undefined> => {
  // Absolute paths (e.g. ORDINE_EXTRA_RUNTIMES=hermes:C:/tools/hermes.exe)
  // skip PATH lookup entirely.
  if (isAbsolute(binaryName)) {
    return access(binaryName).then(
      () => binaryName,
      () => undefined,
    );
  }

  const whichResult = await ResultAsync.fromPromise(
    execFileAsync(locateBinaryCommand(), [binaryName]),
    () => undefined as never,
  );
  const whichPath = whichResult.isOk() ? firstPath(whichResult.value.stdout) : undefined;
  if (whichPath) return whichPath;

  return probeFallbackDirs(binaryName);
};

const detectBinary = async (
  type: string,
  binaryName: string,
): Promise<DetectedRuntime | undefined> => {
  const parsedType = AgentRuntimeSchema.safeParse(type);
  if (!parsedType.success) return undefined;
  const manifest = getRuntimeManifest(parsedType.data);
  const candidates = [...new Set([binaryName, ...manifest.binaries])];
  const resolvedCandidates = await Promise.all(candidates.map(resolveBinaryPath));
  const path = resolvedCandidates.find((candidate) => candidate !== undefined);
  if (!path) {
    return undefined;
  }

  logger.info(`Found runtime ${type} at ${path}`);

  const command = versionCommand(path);
  const versionResult = await ResultAsync.fromPromise(
    execFileAsync(command.bin, command.args),
    () => undefined as never,
  );
  const version = versionResult.isOk() ? versionResult.value.stdout.trim() || undefined : undefined;
  const models = await probeRuntimeModels({ type: parsedType.data, path });

  return {
    type: parsedType.data,
    binaryName,
    path,
    version,
    ...(models === undefined ? {} : { models }),
    ...(models === undefined ? {} : { modelsSource: "live" as const }),
    compatibility: manifest,
  };
};

export const scanRuntimes = async (): Promise<DetectedRuntime[]> => {
  const entries = Object.entries(getRuntimeBinaries());
  const results = await Promise.all(
    entries.map(([type, binaryName]) => detectBinary(type, binaryName)),
  );

  return results.filter((r): r is DetectedRuntime => r !== undefined);
};
