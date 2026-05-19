import { ResultAsync } from "neverthrow";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type SchemaCoverage = "complete" | "empty" | "partial";

const PG_DATABASE = "ordine";

const quoteSqlLiteral = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`;

export const extractCreatedTableNames = (sql: string): string[] =>
  Array.from(sql.matchAll(/^\s*CREATE TABLE "([^"]+)"/gm), (match) => match[1]).filter(
    (tableName): tableName is string => typeof tableName === "string",
  );

export const classifySchemaCoverage = (
  existingTables: string[],
  expectedTables: string[],
): SchemaCoverage => {
  const existingSet = new Set(existingTables.filter((tableName) => tableName !== "_ordine_migrations"));

  if (existingSet.size === 0) {
    return "empty";
  }

  return expectedTables.every((tableName) => existingSet.has(tableName)) ? "complete" : "partial";
};

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
      const existingDatabases = await adminSql.unsafe(
        `SELECT datname FROM pg_database WHERE datname = ${quoteSqlLiteral(PG_DATABASE)}`,
      ) as Array<{ datname: string }>;
      if (existingDatabases.length === 0) {
        await adminSql.unsafe(`CREATE DATABASE "${PG_DATABASE}"`);
      }
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

      if (files.length === 0) {
        await sql.end();

        return 0;
      }

      // If tracking table is empty but database already has user tables,
      // infer whether we have a complete pre-tracking bootstrap or a partial failure.
      if (appliedSet.size === 0) {
        const tables = await sql.unsafe(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_ordine_migrations'`,
        ) as Array<{ tablename: string }>;
        const existingTableNames = tables.map((table) => table.tablename);

        if (existingTableNames.length > 0) {
          if (files.length !== 1) {
            throw new Error(
              "Existing databases without migration tracking are only supported when a single initial migration file is present.",
            );
          }

          const initialMigration = files[0];
          if (!initialMigration) {
            throw new Error("A bootstrap migration file is required to infer existing schema state.");
          }
          const initialMigrationSql = readFileSync(join(migrationsDir, initialMigration), "utf8");
          const expectedTables = extractCreatedTableNames(initialMigrationSql);
          const schemaCoverage = classifySchemaCoverage(existingTableNames, expectedTables);

          if (schemaCoverage === "partial") {
            throw new Error(
              "Detected a partially initialized database without migration tracking. Remove the data directory or restore a complete database before rerunning onboarding.",
            );
          }

          if (schemaCoverage === "complete") {
            await sql.unsafe(
              `INSERT INTO _ordine_migrations (name) VALUES (${quoteSqlLiteral(initialMigration)})`,
            );

            await sql.end();

            return 0;
          }
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

        await sql.unsafe(`INSERT INTO _ordine_migrations (name) VALUES (${quoteSqlLiteral(file)})`);
      }

      await sql.end();

      return pending.length;
    })(),
    (e) => new Error(`Failed to run migrations: ${e instanceof Error ? e.message : String(e)}`),
  );
