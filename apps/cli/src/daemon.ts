import { execFile } from "node:child_process";
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
  if (!whichResult) return undefined;

  const path = whichResult.stdout.trim();
  if (!path) return undefined;

  const versionResult = await execFileAsync(path, ["--version"]).catch(() => undefined);
  const version = versionResult?.stdout.trim() || undefined;

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
  const entries = Object.entries(RUNTIME_BINARIES);
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
    connection: r.connection,
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
