import { serve } from "@hono/node-server";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, realpath, access } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import type { Hono } from "hono";
import { createExecutionDatabase } from "@repo/db/execution";
import { ExecutionIdentifierSchema, ExecutionScopeSchema } from "@repo/schemas";
import { createExecutionApplication, type ExecutionApplication } from "./executionComposition";

const TokenSchema = z
  .string()
  .min(32)
  .max(4096)
  .regex(/^[A-Za-z0-9._~+/-]+=*$/u);
const ConfigSchema = z.strictObject({
  databaseUrl: z.string().min(1),
  schema: z.string().default("public"),
  initialize: z.boolean(),
  dataDirectory: z.string().refine(isAbsolute),
  appToken: TokenSchema,
  agentToken: TokenSchema.optional(),
  subjectId: ExecutionIdentifierSchema.default("owner"),
  workspaceId: ExecutionIdentifierSchema.default("local"),
  instanceId: z.uuid(),
  port: z.coerce.number().int().min(0).max(65535),
  desktop: z.boolean(),
  migrationPath: z.string().refine(isAbsolute),
  javascriptPath: z.string().optional(),
  pythonPath: z.string().optional(),
  bashPath: z.string().optional(),
  allowedOrigins: z.array(z.string()),
  stdinControl: z.boolean(),
  buildRevision: z.string().min(1),
});
type Config = z.infer<typeof ConfigSchema>;
export type ExecutionProductSurface = {
  fetch: Hono["fetch"];
  closeAdmission: () => void;
  close: () => Promise<void>;
};
export type ExecutionProductFactory = (context: {
  config: Config;
  port: number;
  agentTokenFile: string;
}) => Promise<ExecutionProductSurface>;
const safeStartError = (error: unknown) =>
  error instanceof Error && error.name === "ExecutionDatabaseError"
    ? error.message
    : "Execution server could not start. Check its v2 configuration, database, and port.";
const readable = async (path: string) => {
  const result = await ResultAsync.fromPromise(access(path), () => false);

  return result.isOk();
};
const nativeOnPath = async (name: string) => {
  for (const directory of (process.env.PATH ?? "").split(
    process.platform === "win32" ? ";" : ":",
  )) {
    if (!directory || /WindowsApps/iu.test(directory)) continue;
    const candidate = join(directory, name);
    if (isAbsolute(candidate) && (await readable(candidate))) return realpath(candidate);
  }

  return undefined;
};
const agentCredential = async (config: Config) => {
  const path = join(config.dataDirectory, "agent-token");
  const existing = await ResultAsync.fromPromise(readFile(path, "utf8"), () => null);
  const token =
    config.agentToken ??
    (existing.isOk() ? TokenSchema.parse(existing.value.trim()) : randomBytes(32).toString("hex"));
  if (token === config.appToken) throw new Error("Application and agent credentials must differ");
  if (config.agentToken || existing.isErr())
    await writeFile(path, token, {
      encoding: "utf8",
      mode: 0o600,
      ...(config.agentToken ? {} : { flag: "wx" }),
    });
};

/** Explicit v2-only composition. Importing this module never opens the legacy database. */
export const startExecutionServer = (
  configInput: Config,
  createProduct?: ExecutionProductFactory,
) =>
  ResultAsync.fromPromise(
    (async () => {
      const config = ConfigSchema.parse(configInput);
      const state: {
        application?: ExecutionApplication;
        server?: ReturnType<typeof serve>;
        closing?: Promise<void>;
        requested: boolean;
        port?: number;
        product?: ExecutionProductSurface;
      } = { requested: false };
      const shutdown = () => {
        state.requested = true;
        if (state.closing || !state.application) return;
        const application = state.application;
        application.closeAdmission();
        state.product?.closeAdmission();
        state.server?.close();
        state.closing = (async () => {
          const drained = await ResultAsync.fromPromise(application.drainRequests(), () => false);
          const [stopped, productStopped] = await Promise.all([
            application.dispatcher.stop(),
            ResultAsync.fromPromise(
              state.product?.close() ?? Promise.resolve(),
              () => new Error("Authoring shutdown did not settle"),
            ),
          ]);
          if (state.server && "closeAllConnections" in state.server)
            state.server.closeAllConnections();
          await application.database.close();
          if (drained.isErr() || stopped.isErr() || productStopped.isErr()) process.exitCode = 1;
          control?.close();
          process.stdin.pause();
        })();
      };
      const control = config.stdinControl
        ? createInterface({ input: process.stdin, terminal: false })
        : undefined;
      if (control) {
        const permitted = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), 20_000);
          control.once("line", (line) => {
            clearTimeout(timer);
            resolve(line === "ORDINE_EXECUTION_START");
          });
          control.once("close", () => {
            clearTimeout(timer);
            resolve(false);
            shutdown();
          });
        });
        if (!permitted) throw new Error("Native parent did not confirm process ownership");
        control.on("line", (line) => {
          if (line === "ORDINE_EXECUTION_STOP") shutdown();
        });
      }
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
      await mkdir(config.dataDirectory, { recursive: true });
      const initialized = await createExecutionDatabase({
        url: config.databaseUrl,
        schema: config.schema,
        initialize: config.initialize,
        migrationPath: config.migrationPath,
      });
      if (initialized.isErr()) throw initialized.error;
      const transport = config.desktop ? ("desktop" as const) : ("bearer" as const);
      const identity = { subjectId: config.subjectId, workspaceId: config.workspaceId };
      const scriptExecutables = {
        javascript: config.javascriptPath ?? process.execPath,
        python:
          config.pythonPath ??
          (await nativeOnPath(process.platform === "win32" ? "python.exe" : "python3")),
        bash:
          config.bashPath ??
          (process.platform === "win32"
            ? (await readable("C:/Program Files/Git/bin/bash.exe"))
              ? "C:/Program Files/Git/bin/bash.exe"
              : undefined
            : await nativeOnPath("bash")),
      };
      const created = await createExecutionApplication({
        database: initialized.value,
        artifactDirectory: join(config.dataDirectory, "artifacts"),
        ...identity,
        instanceId: config.instanceId,
        buildRevision: config.buildRevision,
        scriptExecutables,
        auth: {
          mode: config.desktop ? "desktop" : "service",
          allowedOrigins: config.allowedOrigins,
          credentials: [
            {
              ...identity,
              audience: "app",
              transport,
              scopes: ExecutionScopeSchema.options,
              token: config.appToken,
            },
            {
              ...identity,
              audience: "agent",
              transport: "bearer",
              scopes: ExecutionScopeSchema.options.filter((scope) => scope !== "execution:approve"),
              readToken: async () =>
                TokenSchema.parse(
                  (await readFile(join(config.dataDirectory, "agent-token"), "utf8")).trim(),
                ),
            },
          ],
        },
        onShutdown: shutdown,
      });
      if (created.isErr()) {
        await initialized.value.close();
        throw new Error(created.error.message);
      }
      state.application = created.value;
      if (state.requested) {
        shutdown();
        await state.closing;

        return state;
      }
      const listening = await ResultAsync.fromPromise(
        new Promise<number>((resolve, reject) => {
          state.server = serve(
            {
              fetch: (request, ...rest) => {
                const pathname = new URL(request.url).pathname;
                if (createProduct && pathname !== "/api/v2" && !pathname.startsWith("/api/v2/"))
                  return state.product
                    ? state.product.fetch(request, ...rest)
                    : Response.json(
                        { error: "Authoring service is initializing" },
                        { status: 503 },
                      );

                return created.value.app.fetch(request, ...rest);
              },
              hostname: "127.0.0.1",
              port: config.port,
            },
            (address) => resolve(address.port),
          );
          state.server.once("error", reject);
        }),
        (error) => error,
      );
      if (listening.isErr()) {
        shutdown();
        await state.closing;
        throw listening.error;
      }
      state.port = listening.value;
      const credential = await ResultAsync.fromPromise(agentCredential(config), (error) => error);
      if (credential.isErr()) {
        shutdown();
        await state.closing;
        throw credential.error;
      }
      if (createProduct) {
        const surface = await ResultAsync.fromPromise(
          createProduct({
            config,
            port: listening.value,
            agentTokenFile: join(config.dataDirectory, "agent-token"),
          }),
          (error) => error,
        );
        if (surface.isErr()) {
          shutdown();
          await state.closing;
          throw surface.error;
        }
        state.product = surface.value;
        if (state.requested) {
          surface.value.closeAdmission();
          await surface.value.close();
          await state.closing;

          return state;
        }
      }
      const started = await created.value.dispatcher.start();
      if (started.isErr()) {
        shutdown();
        await state.closing;
        throw new Error(started.error.message);
      }
      if (state.requested) {
        shutdown();
        await state.closing;

        return state;
      }
      console.log(
        `ORDINE_EXECUTION_READY ${JSON.stringify({ apiVersion: 2, instanceId: config.instanceId, workspaceId: config.workspaceId, port: listening.value })}`,
      );

      return { ...state, shutdown, application: created.value };
    })(),
    safeStartError,
  );

export const executionServerConfig = (desktop: boolean) =>
  ConfigSchema.parse({
    databaseUrl: process.env.ORDINE_EXECUTION_DATABASE_URL,
    schema: process.env.ORDINE_EXECUTION_SCHEMA,
    initialize: process.env.ORDINE_EXECUTION_INITIALIZE === "true",
    dataDirectory: process.env.ORDINE_EXECUTION_DATA_DIR ?? join(homedir(), ".ordine", "v2"),
    appToken: process.env.ORDINE_EXECUTION_APP_TOKEN,
    agentToken: process.env.ORDINE_EXECUTION_AGENT_TOKEN,
    subjectId: process.env.ORDINE_EXECUTION_SUBJECT_ID,
    workspaceId: process.env.ORDINE_EXECUTION_WORKSPACE_ID,
    instanceId: process.env.ORDINE_EXECUTION_INSTANCE_ID ?? randomUUID(),
    port: process.env.ORDINE_EXECUTION_PORT ?? "19433",
    desktop,
    migrationPath:
      process.env.ORDINE_EXECUTION_MIGRATION_PATH ??
      fileURLToPath(new URL("../../create/migrations-v2/0001_execution.sql", import.meta.url)),
    javascriptPath: process.env.ORDINE_EXECUTION_JAVASCRIPT_PATH,
    pythonPath: process.env.ORDINE_EXECUTION_PYTHON_PATH,
    bashPath: process.env.ORDINE_EXECUTION_BASH_PATH,
    allowedOrigins: (
      process.env.ORDINE_EXECUTION_ALLOWED_ORIGINS ??
      "http://tauri.localhost,https://tauri.localhost,http://localhost:9431,http://127.0.0.1:9431,http://localhost:9430,http://127.0.0.1:9430"
    )
      .split(",")
      .filter(Boolean),
    stdinControl: process.env.ORDINE_EXECUTION_STDIN_CONTROL === "true",
    buildRevision: process.env.ORDINE_EXECUTION_BUILD_REVISION ?? "pipeline-v2-local",
  });
