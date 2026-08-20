import { err, ok, Result, ResultAsync, type Result as NeverthrowResult } from "neverthrow";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrations";

export interface OnboardOptions {
  nonInteractive: boolean;
  dataDir?: string;
}

export interface OnboardResult {
  dataDir: string;
  appUrl: string;
  databaseUrl: string;
}

export interface EnvConfig {
  APP_PORT: number;
  APP_URL: string;
  SECRET_KEY: string;
  DATA_DIR: string;
  DATABASE_URL: string;
}

const DEFAULT_APP_PORT = 9430;

const flattenAsyncResult = <T>(
  promise: Promise<NeverthrowResult<T, Error>>,
): ResultAsync<T, Error> => ResultAsync.fromSafePromise(promise).andThen((result) => result);

const toError = (error: unknown, prefix: string): Error =>
  new Error(`${prefix}: ${error instanceof Error ? error.message : String(error)}`);

export const resolveDataDir = (custom?: string): string =>
  custom ?? join(homedir(), ".ordine", "default");

export const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ordine";

export const generateEnvConfig = (
  dataDir: string,
  databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
): EnvConfig => ({
  APP_PORT: DEFAULT_APP_PORT,
  APP_URL: `http://localhost:${DEFAULT_APP_PORT}`,
  SECRET_KEY: randomBytes(32).toString("hex"),
  DATA_DIR: dataDir,
  DATABASE_URL: databaseUrl,
});

export const resolveEnvConfig = (
  dataDir: string,
  existingConfig: EnvConfig | null,
  databaseUrl: string,
): EnvConfig => {
  const baseConfig = existingConfig ?? generateEnvConfig(dataDir, databaseUrl);

  return {
    ...baseConfig,
    DATA_DIR: baseConfig.DATA_DIR || dataDir,
    DATABASE_URL: databaseUrl,
  };
};

export const isExistingInstall = (dataDir: string): boolean => existsSync(join(dataDir, ".env"));

export const readExistingEnv = (dataDir: string): Result<EnvConfig, Error> => {
  const envPath = join(dataDir, ".env");

  return Result.fromThrowable(
    () => readFileSync(envPath, "utf8"),
    (e) => new Error(`Failed to read existing .env: ${String(e)}`),
  )().andThen((content) => {
    const entries = content
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const idx = line.indexOf("=");

        return [line.slice(0, idx), line.slice(idx + 1)] as [string, string];
      });
    const env = Object.fromEntries(entries) as Record<string, string>;

    if (env["PGLITE_DATA_DIR"]) {
      return err(
        new Error(
          `Legacy PGlite data detected at ${env["PGLITE_DATA_DIR"]}. ` +
            "Ordine will not switch this install to an empty PostgreSQL database automatically. " +
            "Back up the PGlite directory, migrate its data to PostgreSQL, then remove PGLITE_DATA_DIR from .env.",
        ),
      );
    }

    return ok({
      APP_PORT: Number(env["APP_PORT"]) || DEFAULT_APP_PORT,
      APP_URL: env["APP_URL"] ?? `http://localhost:${DEFAULT_APP_PORT}`,
      SECRET_KEY: env["SECRET_KEY"] ?? randomBytes(32).toString("hex"),
      DATA_DIR: env["DATA_DIR"] ?? dataDir,
      DATABASE_URL: env["DATABASE_URL"] ?? DEFAULT_DATABASE_URL,
    });
  });
};

export const prepareDataDir = (dataDir: string): Result<string, Error> => {
  if (existsSync(dataDir)) {
    return ok(dataDir);
  }

  const mkdirResult = Result.fromThrowable(
    () => mkdirSync(dataDir, { recursive: true }),
    (e) => new Error(`Failed to create data directory: ${String(e)}`),
  )();

  return mkdirResult.map(() => dataDir);
};

export const writeEnvFile = (dataDir: string, config: EnvConfig): Result<string, Error> => {
  const envPath = join(dataDir, ".env");
  const content = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const writeResult = Result.fromThrowable(
    () => writeFileSync(envPath, content, "utf8"),
    (e) => new Error(`Failed to write env file: ${String(e)}`),
  )();

  return writeResult.map(() => envPath);
};

export const formatOutput = (result: OnboardResult): string => {
  const databaseUrl = URL.canParse(result.databaseUrl) ? new URL(result.databaseUrl) : null;
  if (databaseUrl) {
    if (databaseUrl.username) databaseUrl.username = "***";
    if (databaseUrl.password) databaseUrl.password = "***";
  }
  const lines = [
    "",
    "Ordine is running locally.",
    "",
    `App:      ${result.appUrl}`,
    `Database: ${databaseUrl?.toString() ?? "<configured>"}`,
    `Data:     ${result.dataDir}`,
    "",
    "Press Ctrl+C to stop.",
    "",
  ];

  return lines.join("\n");
};

const getModuleDir = (): string => dirname(fileURLToPath(import.meta.url));

export const resolveAppServerEntry = (baseDir = getModuleDir()): Result<string, Error> => {
  const thisDir = baseDir;

  const devPath = join(thisDir, "..", "app", "server", "index.mjs");
  if (existsSync(devPath)) return ok(devPath);

  const distPath = join(thisDir, "app", "server", "index.mjs");
  if (existsSync(distPath)) return ok(distPath);

  return err(new Error("App server entry not found. Ensure the app is built."));
};

export const resolveMigrationsDir = (baseDir = getModuleDir()): Result<string, Error> => {
  const thisDir = baseDir;

  const devPath = join(thisDir, "..", "migrations");
  if (existsSync(devPath)) return ok(devPath);

  const distPath = join(thisDir, "migrations");
  if (existsSync(distPath)) return ok(distPath);

  return err(new Error("Migrations directory not found. Ensure the app is built."));
};

export const startAppServer = (
  serverEntry: string,
  envConfig: EnvConfig,
): ResultAsync<void, Error> =>
  flattenAsyncResult(
    new Promise<NeverthrowResult<void, Error>>((resolve) => {
      const child = fork(serverEntry, [], {
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: String(envConfig.APP_PORT),
          DATABASE_URL: envConfig.DATABASE_URL,
          BETTER_AUTH_SECRET: envConfig.SECRET_KEY,
          ORDINE_LOCAL_MODE: "true",
          ORDINE_SELF_HOSTED: "true",
        },
        stdio: "inherit",
      });

      const shutdown = () => {
        child.kill("SIGTERM");
      };
      const cleanup = () => {
        process.off("SIGINT", shutdown);
        process.off("SIGTERM", shutdown);
      };

      child.on("error", (error) => {
        cleanup();
        resolve(err(toError(error, "Failed to start app server")));
      });
      child.on("exit", (code) => {
        cleanup();
        resolve(
          code === 0 || code === null
            ? ok(undefined)
            : err(new Error(`App server exited with code ${code}`)),
        );
      });

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    }),
  );

const runOnboard = async (options: OnboardOptions): Promise<NeverthrowResult<void, Error>> => {
  const dataDir = resolveDataDir(options.dataDir);

  const prepareResult = prepareDataDir(dataDir);
  if (prepareResult.isErr()) {
    return err(prepareResult.error);
  }

  console.log("Using Docker PostgreSQL...");

  const existingConfigResult = isExistingInstall(dataDir)
    ? readExistingEnv(dataDir)
    : ok<EnvConfig | null>(null);
  if (existingConfigResult.isErr()) {
    return err(existingConfigResult.error);
  }

  const envConfig = resolveEnvConfig(
    dataDir,
    existingConfigResult.value,
    existingConfigResult.value?.DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  );

  const writeResult = writeEnvFile(dataDir, envConfig);
  if (writeResult.isErr()) {
    return err(writeResult.error);
  }

  const migrationsDirResult = resolveMigrationsDir();
  if (migrationsDirResult.isErr()) {
    return err(migrationsDirResult.error);
  }

  console.log("Running database migrations...");
  const migrateResult = await runMigrations(envConfig.DATABASE_URL, migrationsDirResult.value);
  if (migrateResult.isErr()) {
    return err(migrateResult.error);
  }
  console.log(`Applied ${migrateResult.value} migration file(s).`);

  const serverEntryResult = resolveAppServerEntry();
  if (serverEntryResult.isErr()) {
    return err(serverEntryResult.error);
  }

  const result: OnboardResult = {
    dataDir,
    appUrl: envConfig.APP_URL,
    databaseUrl: envConfig.DATABASE_URL,
  };

  console.log(formatOutput(result));

  const startServerResult = await startAppServer(serverEntryResult.value, envConfig);

  return startServerResult.isOk() ? ok(undefined) : err(startServerResult.error);
};

export const onboard = (options: OnboardOptions): ResultAsync<void, Error> =>
  flattenAsyncResult(runOnboard(options));
