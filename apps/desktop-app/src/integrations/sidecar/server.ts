import { Command, type Child } from "@tauri-apps/plugin-shell";
import { resolveResource } from "@tauri-apps/api/path";

const SERVER_PORT = 9433;
const HEALTH_URL = `http://localhost:${SERVER_PORT}/health`;
const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 200;

let serverProcess: Child | null = null;

async function waitForHealth(): Promise<void> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
  }
  throw new Error(`Server failed to start within ${(MAX_RETRIES * RETRY_INTERVAL_MS) / 1000}s`);
}

async function isServerAlreadyRunning(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL);
    return res.ok;
  } catch {
    return false;
  }
}

export async function startServer(): Promise<void> {
  if (serverProcess) return;

  // If server is already running (e.g. dev mode), skip sidecar spawn
  if (await isServerAlreadyRunning()) {
    console.log("[sidecar] server already running, skipping spawn");
    return;
  }

  // Resolve the bundle path from Tauri resources
  const bundlePath = await resolveResource("resources/server/server-bundle.mjs");

  const command = Command.sidecar("binaries/ordine-server", [bundlePath], {
    env: {
      NODE_ENV: "production",
    },
  });

  command.on("error", (error) => {
    console.error("[sidecar] server error:", error);
  });

  command.stdout.on("data", (line) => {
    console.log("[sidecar:stdout]", line);
  });

  command.stderr.on("data", (line) => {
    console.error("[sidecar:stderr]", line);
  });

  command.on("close", (data) => {
    console.log(`[sidecar] server exited with code ${data.code}, signal ${data.signal}`);
    serverProcess = null;
  });

  serverProcess = await command.spawn();
  await waitForHealth();
}

export async function stopServer(): Promise<void> {
  if (serverProcess) {
    await serverProcess.kill();
    serverProcess = null;
  }
}

export function isServerRunning(): boolean {
  return serverProcess !== null;
}
