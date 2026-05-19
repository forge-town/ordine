import { ok, Result } from "neverthrow";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startEmbeddedPostgres, type EmbeddedPgInstance } from "./embedded-pg";
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

export const resolveDataDir = (custom?: string): string =>
  custom ?? join(homedir(), ".ordine", "default");

export const generateEnvConfig = (dataDir: string, databaseUrl?: string): EnvConfig => ({
  APP_PORT: DEFAULT_APP_PORT,
  APP_URL: `http://localhost:${DEFAULT_APP_PORT}`,
  SECRET_KEY: randomBytes(32).toString("hex"),
  DATA_DIR: dataDir,
  DATABASE_URL: databaseUrl ?? "",
});

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
        DATABASE_URL: env["DATABASE_URL"] ?? "",
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

export const resolveAppServerEntry = (): string => {
  const thisDir = dirname(fileURLToPath(import.meta.url));

  const devPath = join(thisDir, "..", "app", "server", "index.mjs");
  if (existsSync(devPath)) return devPath;

  const distPath = join(thisDir, "app", "server", "index.mjs");
  if (existsSync(distPath)) return distPath;

  throw new Error("App server entry not found. Ensure the app is built.");
};

export const resolveMigrationsDir = (): string => {
  const thisDir = dirname(fileURLToPath(import.meta.url));

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
        DATABASE_URL: envConfig.DATABASE_URL,
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

  const pg: EmbeddedPgInstance = pgResult.value;
  const shutdownPg = async () => {
    await pg.stop();
  };

  process.on("SIGINT", () => void shutdownPg());
  process.on("SIGTERM", () => void shutdownPg());

  console.log(`PostgreSQL running on port ${pg.port}`);

  const existing = isExistingInstall(dataDir);
  const envConfig = existing
    ? readExistingEnv(dataDir).unwrapOr(generateEnvConfig(dataDir, pg.connectionString))
    : generateEnvConfig(dataDir, pg.connectionString);

  envConfig.DATABASE_URL = pg.connectionString;

  if (!existing) {
    const writeResult = writeEnvFile(dataDir, envConfig);
    if (writeResult.isErr()) {
      await shutdownPg();
      throw new Error(writeResult.error.message);
    }
  }

  const migrationsDir = resolveMigrationsDir();
  console.log("Running database migrations...");
  const migrateResult = await runMigrations(pg.connectionString, migrationsDir);
  if (migrateResult.isErr()) {
    await shutdownPg();
    throw new Error(migrateResult.error.message);
  }
  console.log(`Applied ${migrateResult.value} migration file(s).`);

  const serverEntry = resolveAppServerEntry();
  const result: OnboardResult = {
    dataDir,
    appUrl: envConfig.APP_URL,
    databaseUrl: pg.connectionString,
  };

  console.log(formatOutput(result));
  await startAppServer(serverEntry, envConfig);
  await shutdownPg();
};
