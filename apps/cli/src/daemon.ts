import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ResultAsync } from "neverthrow";
import { api } from "./api";

const HEARTBEAT_INTERVAL_MS = 15_000;

interface DetectedRuntime {
  id: string;
  name: string;
  type: string;
  binaryName: string;
  path: string;
  version?: string;
  connection: { mode: "local" };
}

/**
 * NOTE: this scan logic intentionally mirrors `packages/agent/src/scan/scanRuntimes.ts`.
 * The CLI is published to npm standalone while `@repo/agent` is private, so it
 * cannot import the shared implementation — keep the two in sync manually.
 */
const RUNTIME_BINARIES: Record<string, string> = {
  "claude-code": "claude",
  codex: "codex",
  hermes: "hermes",
  mastra: "mastra",
  openclaw: "openclaw",
  "pi-agent": "pi",
  opencode: "opencode",
  "kimi-code": "kimi",
};

/**
 * `ORDINE_EXTRA_RUNTIMES` (`name:bin,name2:bin2`) can override a known binary
 * or register additional runtime types. Validation against the runtime enum
 * happens server-side (syncAll is zod-validated), so here we merge blindly.
 */
const getRuntimeBinaries = (env: NodeJS.ProcessEnv = process.env): Record<string, string> => {
  const binaries: Record<string, string> = { ...RUNTIME_BINARIES };
  const raw = env["ORDINE_EXTRA_RUNTIMES"];
  if (!raw) return binaries;
  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const name = trimmed.slice(0, colon).trim();
    const bin = trimmed.slice(colon + 1).trim();
    if (!name || !bin) continue;
    binaries[name] = bin;
  }

  return binaries;
};

const LOCATE_BINARY_COMMAND = process.platform === "win32" ? "where.exe" : "which";

const firstPath = (stdout: string): string | undefined => {
  const paths = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (process.platform === "win32") {
    return paths.find((line) => line.toLowerCase().endsWith(".exe")) ?? paths[0];
  }

  return paths[0];
};

const execFileAsync = (bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 10_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);

        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/**
 * Directories where agent CLIs are commonly installed but which are often
 * missing from the PATH of a daemon / launchd / Finder-launched process.
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
  const whichResult = await ResultAsync.fromPromise(
    execFileAsync(LOCATE_BINARY_COMMAND, [binaryName]),
    () => undefined as never,
  );
  const whichPath = whichResult.isOk() ? firstPath(whichResult.value.stdout) : undefined;
  if (whichPath || process.platform === "win32") return whichPath;

  return probeFallbackDirs(binaryName);
};

const detectBinary = async (
  type: string,
  binaryName: string,
): Promise<DetectedRuntime | undefined> => {
  const path = await resolveBinaryPath(binaryName);
  if (!path) return undefined;

  const versionResult = await ResultAsync.fromPromise(
    execFileAsync(path, ["--version"]),
    () => undefined as never,
  );
  const version = versionResult.isOk() ? versionResult.value.stdout.trim() || undefined : undefined;

  return {
    id: `local-${type}`,
    name: type,
    type,
    binaryName,
    path,
    version,
    connection: { mode: "local" },
  };
};

const scanLocalRuntimes = async (): Promise<DetectedRuntime[]> => {
  const entries = Object.entries(getRuntimeBinaries());
  const results = await Promise.all(
    entries.map(([type, binaryName]) => detectBinary(type, binaryName)),
  );

  return results.filter((r): r is DetectedRuntime => r !== undefined);
};

const syncRuntimes = async (runtimes: DetectedRuntime[]): Promise<boolean> => {
  const payload = runtimes.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    connection: {
      mode: "local" as const,
      binaryName: r.binaryName,
      path: r.path,
      version: r.version,
      detectedAt: new Date().toISOString(),
    },
  }));

  const result = await api.post("/api/trpc/agentRuntimes.syncAll", {
    json: { runtimes: payload },
  });
  if (!result.ok) {
    console.error(`    Server responded: ${result.message}`);
  }

  return result.ok;
};

export const startDaemon = async (options: { interval?: number; once?: boolean }): Promise<void> => {
  const interval = options.interval ?? HEARTBEAT_INTERVAL_MS;

  console.log("🔍 Scanning local runtimes...");
  const runtimes = await scanLocalRuntimes();

  if (runtimes.length === 0) {
    console.log("  No runtimes detected.");
  } else {
    console.log(`  Detected ${runtimes.length} runtime(s):`);
    for (const r of runtimes) {
      console.log(`    • ${r.type} → ${r.path}${r.version ? ` (${r.version})` : ""}`);
    }
  }

  console.log("\n📡 Syncing with server...");
  const ok = await syncRuntimes(runtimes);
  if (ok) {
    console.log("  ✓ Synced successfully.");
  } else {
    console.error("  ✗ Failed to sync with server.");
  }

  if (options.once) return;

  console.log(`\n🔄 Daemon running (heartbeat every ${interval / 1000}s). Press Ctrl+C to stop.\n`);

  const tick = async () => {
    const latest = await scanLocalRuntimes();
    const synced = await syncRuntimes(latest);
    const ts = new Date().toLocaleTimeString();
    if (synced) {
      console.log(`  [${ts}] heartbeat OK — ${latest.length} runtime(s)`);
    } else {
      console.error(`  [${ts}] heartbeat FAILED`);
    }
  };

  setInterval(() => void tick(), interval);
};
