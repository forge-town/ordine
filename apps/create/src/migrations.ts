import { ResultAsync } from "neverthrow";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const runMigrations = (connectionString: string, migrationsDir: string): ResultAsync<number, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      const { default: postgres } = (await import("postgres")) as {
        default: (url: string, opts?: { onnotice: () => void }) => {
          unsafe(query: string): Promise<unknown[]>;
          end(): Promise<void>;
        };
      };

      // Connect to "postgres" database to create the target database
      const adminUrl = connectionString.replace(/\/[^/]+$/, "/postgres");
      const adminSql = postgres(adminUrl, { onnotice: () => {} });
      await adminSql.unsafe(`CREATE DATABASE ordine`).catch(() => {
        /* already exists */
      });
      await adminSql.end();

      // Now connect to the target database for migrations
      const sql = postgres(connectionString, { onnotice: () => {} });

      // Create migrations tracking table
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS _ordine_migrations (
          id serial PRIMARY KEY,
          name text NOT NULL UNIQUE,
          applied_at timestamp DEFAULT now() NOT NULL
        )
      `);

      // Get already-applied migrations
      const applied = await sql.unsafe(`SELECT name FROM _ordine_migrations`) as Array<{ name: string }>;
      const appliedSet = new Set(applied.map((r) => r.name));

      const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      // If tracking table is empty but database already has user tables,
      // mark all migrations as applied (upgrade from pre-tracking state)
      if (appliedSet.size === 0) {
        const tables = await sql.unsafe(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_ordine_migrations'`,
        ) as Array<{ tablename: string }>;

        if (tables.length > 0) {
          for (const file of files) {
            await sql.unsafe(`INSERT INTO _ordine_migrations (name) VALUES ('${file}')`);
          }

          await sql.end();

          return 0;
        }
      }

      const pending = files.filter((f) => !appliedSet.has(f));

      for (const file of pending) {
        const content = readFileSync(join(migrationsDir, file), "utf8");
        const statements = content
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const statement of statements) {
          await sql.unsafe(statement);
        }

        await sql.unsafe(`INSERT INTO _ordine_migrations (name) VALUES ('${file}')`);
      }

      await sql.end();

      return pending.length;
    })(),
    (e) => new Error(`Failed to run migrations: ${e instanceof Error ? e.message : String(e)}`),
  );
