import { Command, type Child } from "@tauri-apps/plugin-shell";
import { resolveResource } from "@tauri-apps/api/path";
import { ResultAsync } from "neverthrow";

const SERVER_PORT = 9433;
const HEALTH_URL = `http://127.0.0.1:${SERVER_PORT}/health`;
const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 200;

const serverState = {
  process: null as Child | null,
  authToken: null as string | null,
};

export const getDesktopAuthToken = (): string | null => serverState.authToken;

const waitForHealth = (remaining: number = MAX_RETRIES): ResultAsync<void, Error> => {
  if (remaining <= 0) {
    return ResultAsync.fromPromise(
      Promise.reject(
        new Error(
          `Server failed to start within ${(MAX_RETRIES * RETRY_INTERVAL_MS) / 1000}s. ` +
            "Ensure Docker PostgreSQL is running and DATABASE_URL points to it.",
        ),
      ),
      (e) => (e instanceof Error ? e : new Error(String(e))),
    );
  }

  return ResultAsync.fromPromise(fetch(HEALTH_URL), () => null)
    .orElse(() => ResultAsync.fromSafePromise(Promise.resolve(null)))
    .andThen((res) => {
      if (res?.ok) {
        return ResultAsync.fromSafePromise(Promise.resolve(undefined));
      }

      return ResultAsync.fromPromise(
        new Promise<void>((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS)),
        () => new Error("timeout"),
      ).andThen(() => waitForHealth(remaining - 1));
    });
};

const isServerAlreadyRunning = (): ResultAsync<boolean, never> =>
  ResultAsync.fromPromise(fetch(HEALTH_URL), () => null)
    .map((res) => res?.ok ?? false)
    .orElse(() => ResultAsync.fromSafePromise(Promise.resolve(false)));

export const startServer = (): ResultAsync<void, Error> => {
  if (serverState.process) {
    return ResultAsync.fromSafePromise(Promise.resolve(undefined));
  }

  return isServerAlreadyRunning().andThen((running) => {
    if (running) {
      console.log("[sidecar] server already running, skipping spawn");

      return ResultAsync.fromSafePromise(Promise.resolve(undefined));
    }

    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const desktopAuthToken = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    serverState.authToken = desktopAuthToken;

    return ResultAsync.fromPromise(
      resolveResource("resources/server/server-bundle.mjs"),
      (e) => new Error(`Failed to resolve resource: ${e}`),
    ).andThen((bundlePath) => {
      const command = Command.sidecar("binaries/ordine-server", [bundlePath], {
        env: {
          NODE_ENV: "production",
          DESKTOP_MODE: "true",
          DESKTOP_AUTH_TOKEN: desktopAuthToken,
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

      return ResultAsync.fromPromise(
        command.spawn(),
        (e) => new Error(`Failed to spawn server: ${e}`),
      ).andThen((child) => {
        serverState.process = child;

        return waitForHealth();
      });
    });
  });
};

export const stopServer = (): ResultAsync<void, Error> => {
  if (!serverState.process) {
    return ResultAsync.fromSafePromise(Promise.resolve(undefined));
  }

  return ResultAsync.fromPromise(
    serverState.process.kill(),
    (e) => new Error(`Failed to stop server: ${e}`),
  ).map(() => {
    serverState.process = null;
  });
};

export const isServerRunning = (): boolean => serverState.process !== null;
