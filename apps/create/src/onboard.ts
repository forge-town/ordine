import { ok, Result } from "neverthrow";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startEmbeddedPostgres } from "./embedded-pg";
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
  PGLITE_DATA_DIR: string;
}

const DEFAULT_APP_PORT = 9430;

export const resolveDataDir = (custom?: string): string =>
  custom ?? join(homedir(), ".ordine", "default");

export const generateEnvConfig = (dataDir: string, pgliteDataDir?: string): EnvConfig => ({
  APP_PORT: DEFAULT_APP_PORT,
  APP_URL: `http://localhost:${DEFAULT_APP_PORT}`,
  SECRET_KEY: randomBytes(32).toString("hex"),
  DATA_DIR: dataDir,
  PGLITE_DATA_DIR: pgliteDataDir ?? join(dataDir, "pglite"),
});

export const resolveEnvConfig = (
  dataDir: string,
  existingConfig: EnvConfig | null,
  pgliteDataDir: string,
): EnvConfig => {
  const baseConfig = existingConfig ?? generateEnvConfig(dataDir, pgliteDataDir);

  return {
    ...baseConfig,
    DATA_DIR: baseConfig.DATA_DIR || dataDir,
    PGLITE_DATA_DIR: pgliteDataDir,
  };
};

export const isExistingInstall = (dataDir: string): boolean =>
  existsSync(join(dataDir, ".env"));

export const readExistingEnv = (dataDir: string): Result<EnvConfig, Error> => {
  const envPath = join(dataDir, ".env");

  return Result.fromThrowable(
    () => {
      const content = readFileSync(envPath, "utf8");
      const entries = content
        .split("\n")
        .filter((line) => line.includes("="))
        .map((line) => {
          const idx = line.indexOf("=");

          return [line.slice(0, idx), line.slice(idx + 1)] as [string, string];
        });
      const env = Object.fromEntries(entries) as Record<string, string>;

      return {
        APP_PORT: Number(env["APP_PORT"]) || DEFAULT_APP_PORT,
        APP_URL: env["APP_URL"] ?? `http://localhost:${DEFAULT_APP_PORT}`,
        SECRET_KEY: env["SECRET_KEY"] ?? randomBytes(32).toString("hex"),
        DATA_DIR: env["DATA_DIR"] ?? dataDir,
        PGLITE_DATA_DIR: env["PGLITE_DATA_DIR"] ?? join(dataDir, "pglite"),
      };
    },
    (e) => new Error(`Failed to read existing .env: ${String(e)}`),
  )();
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
  const lines = [
    "",
    "Ordine is running locally.",
    "",
    `App:      ${result.appUrl}`,
    `Database: ${result.databaseUrl}`,
    `Data:     ${result.dataDir}`,
    "",
    "Press Ctrl+C to stop.",
    "",
  ];

  return lines.join("\n");
};

const getModuleDir = (): string =>
  dirname(fileURLToPath(import.meta.url));

export const resolveAppServerEntry = (baseDir = getModuleDir()): string => {
  const thisDir = baseDir;

  const devPath = join(thisDir, "..", "app", "server", "index.mjs");
  if (existsSync(devPath)) return devPath;

  const distPath = join(thisDir, "app", "server", "index.mjs");
  if (existsSync(distPath)) return distPath;

  throw new Error("App server entry not found. Ensure the app is built.");
};

export const resolveMigrationsDir = (baseDir = getModuleDir()): string => {
  const thisDir = baseDir;

  const devPath = join(thisDir, "..", "migrations");
  if (existsSync(devPath)) return devPath;

  const distPath = join(thisDir, "migrations");
  if (existsSync(distPath)) return distPath;

  throw new Error("Migrations directory not found. Ensure the app is built.");
};

export const startAppServer = (
  serverEntry: string,
  envConfig: EnvConfig,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = fork(serverEntry, [], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(envConfig.APP_PORT),
        PGLITE_DATA_DIR: envConfig.PGLITE_DATA_DIR,
        BETTER_AUTH_SECRET: envConfig.SECRET_KEY,
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`App server exited with code ${code}`));
      }
    });

    const shutdown = () => {
      child.kill("SIGTERM");
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

export const onboard = async (options: OnboardOptions): Promise<void> => {
  const dataDir = resolveDataDir(options.dataDir);

  const prepareResult = prepareDataDir(dataDir);
  if (prepareResult.isErr()) {
    throw new Error(prepareResult.error.message);
  }

  console.log("Starting embedded PostgreSQL...");
  const pgResult = await startEmbeddedPostgres(dataDir);
  if (pgResult.isErr()) {
    throw new Error(pgResult.error.message);
  }

  const pg = pgResult.value;

  console.log("PostgreSQL ready (PGlite)");

  const existing = isExistingInstall(dataDir);
  const existingConfig = existing ? readExistingEnv(dataDir).unwrapOr(null) : null;
  const envConfig = resolveEnvConfig(dataDir, existingConfig, pg.dataDir);

  const writeResult = writeEnvFile(dataDir, envConfig);
  if (writeResult.isErr()) {
    await pg.stop();
    throw new Error(writeResult.error.message);
  }

  const migrationsDir = resolveMigrationsDir();
  console.log("Running database migrations...");
  const migrateResult = await runMigrations(pg.db, migrationsDir);
  if (migrateResult.isErr()) {
    await pg.stop();
    throw new Error(migrateResult.error.message);
  }
  console.log(`Applied ${migrateResult.value} migration file(s).`);

  // Close PGlite before starting app server (PGlite doesn't support multi-process access)
  await pg.stop();

  const serverEntry = resolveAppServerEntry();
  const result: OnboardResult = {
    dataDir,
    appUrl: envConfig.APP_URL,
    databaseUrl: `pglite://${pg.dataDir}`,
  };

  console.log(formatOutput(result));
  await startAppServer(serverEntry, envConfig);
};
