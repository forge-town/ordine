import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ResultAsync } from "neverthrow";
import { initializeAuthoringDatabase, authoringSchemaFor } from "@repo/db/execution";
import type { ExecutionProductFactory } from "./executionServer";

/** Same native owner, socket and App credential; Agent credentials cannot enter App-only routes. */
export const createDesktopProduct: ExecutionProductFactory = async ({
  config,
  port,
  agentTokenFile,
}) => {
  const schema = authoringSchemaFor(config.schema);
  const initialized = await initializeAuthoringDatabase({
    url: config.databaseUrl,
    schema,
    initialize: config.initialize,
    migrationsDirectory: join(dirname(dirname(config.migrationPath)), "migrations-authoring"),
  });
  if (initialized.isErr()) throw initialized.error;
  Object.assign(process.env, {
    DATABASE_URL: config.databaseUrl,
    ORDINE_AUTHORING_SCHEMA: schema,
    DESKTOP_MODE: "true",
    DESKTOP_AUTH_TOKEN: config.appToken,
    ORDINE_DESKTOP_ALLOWED_ORIGINS: JSON.stringify(config.allowedOrigins),
    ORDINE_EXECUTION_API_TARGET: `http://127.0.0.1:${port}`,
    ORDINE_EXECUTION_AGENT_TOKEN_FILE: agentTokenFile,
    ORDINE_AGENT_API_TOKEN: (await readFile(agentTokenFile, "utf8")).trim(),
    ORDINE_DATA_DIR: join(config.dataDirectory, "authoring"),
    PORT: String(port),
  });
  // Import only after selecting the private metadata schema; execution never uses this global DB.
  const { closeAuthoringConnection } = await import("@repo/db");
  const modules = await ResultAsync.fromPromise(
    Promise.all([import("./app"), import("./services")]),
    (error) => error,
  );
  if (modules.isErr()) {
    await closeAuthoringConnection();
    throw modules.error;
  }
  const [{ app }, { agentRunsService }] = modules.value;
  const lifecycle = { closing: false, requests: 0 };

  return {
    fetch: async (request, ...rest) => {
      if (lifecycle.closing && !["GET", "HEAD"].includes(request.method))
        return Response.json({ error: "Application is shutting down" }, { status: 503 });
      lifecycle.requests += 1;
      const result = await ResultAsync.fromPromise(
        Promise.resolve().then(() => app.fetch(request, ...rest)),
        (error) => error,
      );
      lifecycle.requests -= 1;
      if (result.isErr()) throw result.error;

      return result.value;
    },
    closeAdmission: () => {
      lifecycle.closing = true;
      agentRunsService.closeAdmission();
    },
    close: async () => {
      lifecycle.closing = true;
      agentRunsService.closeAdmission();
      const deadline: { timer?: ReturnType<typeof setTimeout> } = {};
      const stopped = await ResultAsync.fromPromise(
        Promise.race([
          (async () => {
            while (lifecycle.requests > 0)
              await new Promise<void>((resolve) => setTimeout(resolve, 20));
            await agentRunsService.stopOwnedRuns();
          })(),
          new Promise<never>((_, reject) => {
            deadline.timer = setTimeout(
              () => reject(new Error("Authoring Agent shutdown timed out")),
              25_000,
            );
          }),
        ]),
        (error) => error,
      );
      if (deadline.timer) clearTimeout(deadline.timer);
      await closeAuthoringConnection();
      if (stopped.isErr()) throw stopped.error;
    },
  };
};
