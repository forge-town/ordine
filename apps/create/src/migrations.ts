import { ResultAsync } from "neverthrow";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

type SchemaCoverage = "complete" | "empty" | "partial";

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

export const runMigrations = (db: PGlite, migrationsDir: string): ResultAsync<number, Error> =>
  ResultAsync.fromPromise(
    (async () => {
      // Create migrations tracking table
      await db.exec(`
        CREATE TABLE IF NOT EXISTS _ordine_migrations (
          id serial PRIMARY KEY,
          name text NOT NULL UNIQUE,
          applied_at timestamp DEFAULT now() NOT NULL
        )
      `);

      // Get already-applied migrations
      const appliedResult = await db.query<{ name: string }>(`SELECT name FROM _ordine_migrations`);
      const appliedSet = new Set(appliedResult.rows.map((r) => r.name));

      const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      if (files.length === 0) {
        return 0;
      }

      // If tracking table is empty but database already has user tables,
      // infer whether we have a complete pre-tracking bootstrap or a partial failure.
      if (appliedSet.size === 0) {
        const tablesResult = await db.query<{ tablename: string }>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_ordine_migrations'`,
        );
        const existingTableNames = tablesResult.rows.map((table) => table.tablename);

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
            await db.exec(
              `INSERT INTO _ordine_migrations (name) VALUES (${quoteSqlLiteral(initialMigration!)})`,
            );

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
          await db.exec(statement);
        }

        await db.exec(`INSERT INTO _ordine_migrations (name) VALUES (${quoteSqlLiteral(file)})`);
      }

      return pending.length;
    })(),
    (e) => new Error(`Failed to run migrations: ${e instanceof Error ? e.message : String(e)}`),
  );
