import { ResultAsync } from "neverthrow";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { arch, platform } from "node:os";

export interface EmbeddedPgInstance {
  connectionString: string;
  port: number;
  stop: () => Promise<void>;
}

type PgCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

const DEFAULT_PG_PORT = 5480;
const PG_USER = "ordine";
const PG_PASSWORD = "ordine";
const PG_DATABASE = "ordine";

const findAvailablePort = async (startPort: number): Promise<number> => {
  const maxAttempts = 20;
  const ports = Array.from({ length: maxAttempts }, (_, i) => startPort + i);

  for (const port of ports) {
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.unref();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });

    if (available) return port;
  }

  throw new Error(`No available port found from ${startPort} to ${startPort + maxAttempts - 1}`);
};

const getPlatformPackageName = (): string | undefined => {
  const p = platform();
  const a = arch();
  const map: Record<string, Record<string, string>> = {
    darwin: { arm64: "darwin-arm64", x64: "darwin-x64" },
    linux: { arm64: "linux-arm64", arm: "linux-arm", ia32: "linux-ia32", ppc64: "linux-ppc64", x64: "linux-x64" },
    win32: { x64: "windows-x64" },
  };

  return map[p]?.[a] ? `@embedded-postgres/${map[p][a]}` : undefined;
};

const resolveEpPlatformEntry = (pkg: string): string | undefined => {
  const require = createRequire(import.meta.url);
  try {
    const epPath = require.resolve("embedded-postgres");
    const require2 = createRequire(epPath);

    return require2.resolve(pkg);
  } catch {
    return undefined;
  }
};

const hydrateSymlinks = (): void => {
  const pkg = getPlatformPackageName();
  if (!pkg) return;

  const pkgEntryPath = resolveEpPlatformEntry(pkg);
  if (!pkgEntryPath) return;

  // pkgEntryPath is e.g. .../darwin-arm64/dist/index.js → go up to package root
  const pkgRoot = resolve(dirname(pkgEntryPath), "..");
  const nativeDir = join(pkgRoot, "native");
  const symlinksFile = join(nativeDir, "pg-symlinks.json");
  if (!existsSync(symlinksFile)) return;

  const symlinks = JSON.parse(readFileSync(symlinksFile, "utf8")) as Array<{ source: string; target: string }>;

  for (const { source, target } of symlinks) {
    const absTarget = resolve(pkgRoot, target);
    if (existsSync(absTarget)) continue;

    const relSource = relative(dirname(absTarget), resolve(pkgRoot, source));
    try {
      symlinkSync(relSource, absTarget);
    } catch {
      // Ignore errors (e.g. symlink already exists via race condition)
    }
  }
};

export const startEmbeddedPostgres = (dataDir: string): ResultAsync<EmbeddedPgInstance, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const pgDataDir = join(dataDir, "pg");
      const needsInit = !existsSync(join(pgDataDir, "PG_VERSION"));

      if (needsInit && existsSync(pgDataDir)) {
        rmSync(pgDataDir, { recursive: true });
      }

      if (!existsSync(pgDataDir)) {
        mkdirSync(pgDataDir, { recursive: true });
      }

      hydrateSymlinks();

      const { default: EmbeddedPostgres } = (await import("embedded-postgres")) as {
        default: PgCtor;
      };

      const port = await findAvailablePort(DEFAULT_PG_PORT);

      const instance = new EmbeddedPostgres({
        databaseDir: pgDataDir,
        user: PG_USER,
        password: PG_PASSWORD,
        port,
        persistent: true,
        initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
        onLog: () => {},
        onError: () => {},
      });

      if (needsInit) {
        await instance.initialise();
      }

      await instance.start();

      const connectionString = `postgres://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${port}/${PG_DATABASE}`;

      return {
        connectionString,
        port,
        stop: () => instance.stop(),
      };
    })(),
    (e) => new Error(`Failed to start embedded PostgreSQL: ${e instanceof Error ? e.message : String(e)}`),
  );
