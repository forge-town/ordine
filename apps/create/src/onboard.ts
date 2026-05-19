import { ok, Result } from "neverthrow";
import { mkdirSync, writeFileSync, readFileSync, existsSync, openSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

export interface OnboardOptions {
  nonInteractive: boolean;
  dataDir?: string;
}

export interface OnboardResult {
  dataDir: string;
  appUrl: string;
  apiUrl: string;
}

export interface EnvConfig {
  APP_PORT: number;
  API_PORT: number;
  APP_URL: string;
  API_URL: string;
  SECRET_KEY: string;
  DATA_DIR: string;
}

const DEFAULT_APP_PORT = 9430;
const DEFAULT_API_PORT = 9433;

export const resolveDataDir = (custom?: string): string =>
  custom ?? join(homedir(), ".ordine", "default");

export const generateEnvConfig = (dataDir: string): EnvConfig => ({
  APP_PORT: DEFAULT_APP_PORT,
  API_PORT: DEFAULT_API_PORT,
  APP_URL: `http://localhost:${DEFAULT_APP_PORT}`,
  API_URL: `http://localhost:${DEFAULT_API_PORT}`,
  SECRET_KEY: randomBytes(32).toString("hex"),
  DATA_DIR: dataDir,
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
        API_PORT: Number(env["API_PORT"]) || DEFAULT_API_PORT,
        APP_URL: env["APP_URL"] ?? `http://localhost:${DEFAULT_APP_PORT}`,
        API_URL: env["API_URL"] ?? `http://localhost:${DEFAULT_API_PORT}`,
        SECRET_KEY: env["SECRET_KEY"] ?? randomBytes(32).toString("hex"),
        DATA_DIR: env["DATA_DIR"] ?? dataDir,
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
    `API:      ${result.apiUrl}`,
    `Data:     ${result.dataDir}`,
    `Status:   ordine status`,
    `Stop:     ordine stop`,
    `Logs:     ordine logs`,
    "",
  ];

  return lines.join("\n");
};

export const startLocalService = (dataDir: string, envConfig: EnvConfig): Result<number, Error> => {
  const logFile = join(dataDir, "ordine.log");

  const logFd = Result.fromThrowable(
    () => openSync(logFile, "a"),
    (e) => new Error(`Failed to open log file: ${String(e)}`),
  )();

  if (logFd.isErr()) {
    return logFd as unknown as Result<number, Error>;
  }

  const spawnResult = Result.fromThrowable(
    () => {
      const child = spawn("npx", ["@ordine/server"], {
        detached: true,
        stdio: ["ignore", logFd.value, logFd.value],
        env: {
          ...process.env,
          PORT: String(envConfig.APP_PORT),
          API_PORT: String(envConfig.API_PORT),
          ORDINE_DATA_DIR: dataDir,
        },
      });
      child.unref();

      return child.pid ?? 0;
    },
    (e) => new Error(`Failed to start service: ${String(e)}`),
  )();

  return spawnResult;
};

export const startDaemon = (dataDir: string, envConfig: EnvConfig): Result<number, Error> => {
  const logFile = join(dataDir, "daemon.log");

  const logFd = Result.fromThrowable(
    () => openSync(logFile, "a"),
    (e) => new Error(`Failed to open daemon log: ${String(e)}`),
  )();

  if (logFd.isErr()) {
    return logFd as unknown as Result<number, Error>;
  }

  const spawnResult = Result.fromThrowable(
    () => {
      const child = spawn("npx", ["ordine", "daemon"], {
        detached: true,
        stdio: ["ignore", logFd.value, logFd.value],
        env: {
          ...process.env,
          ORDINE_API_URL: envConfig.API_URL,
        },
      });
      child.unref();

      return child.pid ?? 0;
    },
    (e) => new Error(`Failed to start daemon: ${String(e)}`),
  )();

  return spawnResult;
};

export const onboard = async (options: OnboardOptions): Promise<void> => {
  const dataDir = resolveDataDir(options.dataDir);

  const prepareResult = prepareDataDir(dataDir);
  if (prepareResult.isErr()) {
    throw new Error(prepareResult.error.message);
  }

  const existing = isExistingInstall(dataDir);
  const envConfig = existing
    ? readExistingEnv(dataDir).unwrapOr(generateEnvConfig(dataDir))
    : generateEnvConfig(dataDir);

  if (!existing) {
    const writeResult = writeEnvFile(dataDir, envConfig);
    if (writeResult.isErr()) {
      throw new Error(writeResult.error.message);
    }
  }

  const serviceResult = startLocalService(dataDir, envConfig);
  if (serviceResult.isErr()) {
    console.error(`Warning: Could not start service: ${serviceResult.error.message}`);
  }

  const daemonResult = startDaemon(dataDir, envConfig);
  if (daemonResult.isErr()) {
    console.error(`Warning: Could not start daemon: ${daemonResult.error.message}`);
  }

  const result: OnboardResult = {
    dataDir,
    appUrl: envConfig.APP_URL,
    apiUrl: envConfig.API_URL,
  };

  console.log(formatOutput(result));
};
