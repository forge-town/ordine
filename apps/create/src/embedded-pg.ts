import { ResultAsync } from "neverthrow";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

export interface EmbeddedPgInstance {
  dataDir: string;
  db: PGlite;
  stop: () => Promise<void>;
}

export const startEmbeddedPostgres = (dataDir: string): ResultAsync<EmbeddedPgInstance, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const pgDataDir = join(dataDir, "pglite");

      if (!existsSync(pgDataDir)) {
        mkdirSync(pgDataDir, { recursive: true });
      }

      const db = new PGlite(pgDataDir);
      await db.waitReady;

      return {
        dataDir: pgDataDir,
        db,
        stop: () => db.close(),
      };
    })(),
    (e) => new Error(`Failed to start embedded PostgreSQL: ${e instanceof Error ? e.message : String(e)}`),
  );
