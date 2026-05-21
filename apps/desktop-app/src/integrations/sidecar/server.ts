import { Command, type Child } from "@tauri-apps/plugin-shell";
import { resolveResource } from "@tauri-apps/api/path";

const SERVER_PORT = 9433;
const HEALTH_URL = `http://127.0.0.1:${SERVER_PORT}/health`;
const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 200;

const serverState = {
  process: null as Child | null,
  authToken: null as string | null,
};

export const getDesktopAuthToken = (): string | null => serverState.authToken;

const waitForHealth = async (remaining: number = MAX_RETRIES): Promise<void> => {
  if (remaining <= 0) {
    throw new Error(
      `Server failed to start within ${(MAX_RETRIES * RETRY_INTERVAL_MS) / 1000}s`,
    );
  }

  const res = await fetch(HEALTH_URL).catch(() => null);

  if (res?.ok) {
    return;
  }

  await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));

  return waitForHealth(remaining - 1);
};

const isServerAlreadyRunning = async (): Promise<boolean> => {
  const res = await fetch(HEALTH_URL).catch(() => null);

  return res?.ok ?? false;
};

export const startServer = async (): Promise<void> => {
  if (serverState.process) {
    return;
  }

  // If server is already running (e.g. dev mode), skip sidecar spawn
  if (await isServerAlreadyRunning()) {
    console.log("[sidecar] server already running, skipping spawn");

    return;
  }

  // Generate per-launch auth token
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  serverState.authToken = Array.from(tokenBytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

  // Resolve the bundle path from Tauri resources
  const bundlePath = await resolveResource("resources/server/server-bundle.mjs");

  const command = Command.sidecar("binaries/ordine-server", [bundlePath], {
    env: {
      NODE_ENV: "production",
      DESKTOP_MODE: "true",
      DESKTOP_AUTH_TOKEN: serverState.authToken,
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
    serverState.process = null;
  });

  serverState.process = await command.spawn();
  await waitForHealth();
};

export const stopServer = async (): Promise<void> => {
  if (serverState.process) {
    await serverState.process.kill();
    serverState.process = null;
  }
};

export const isServerRunning = (): boolean => serverState.process !== null;
