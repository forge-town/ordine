import { err, ok, Result, ResultAsync, type Result as NeverthrowResult } from "neverthrow";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

type SchemaCoverage = "complete" | "empty" | "partial";

const quoteSqlLiteral = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`;

const flattenAsyncResult = <T>(
  promise: Promise<NeverthrowResult<T, Error>>,
): ResultAsync<T, Error> => ResultAsync.fromSafePromise(promise).andThen((result) => result);

const toError = (error: unknown, prefix: string): Error =>
  new Error(`${prefix}: ${error instanceof Error ? error.message : String(error)}`);

const readMigrationFiles = (migrationsDir: string): Result<string[], Error> =>
  Result.fromThrowable(
    () => readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort(),
    (error) => toError(error, "Failed to read migration directory"),
  )();

const readMigrationFile = (migrationsDir: string, fileName: string): Result<string, Error> =>
  Result.fromThrowable(
    () => readFileSync(join(migrationsDir, fileName), "utf8"),
    (error) => toError(error, `Failed to read migration file "${fileName}"`),
  )();

const execSql = (db: PGlite, sql: string, context: string): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(db.exec(sql), (error) => toError(error, context)).map(
    () => undefined,
  );

const queryRows = <TRow>(
  db: PGlite,
  sql: string,
  context: string,
): ResultAsync<{ rows: TRow[] }, Error> =>
  ResultAsync.fromPromise(db.query<TRow>(sql), (error) => toError(error, context));

const insertMigrationRecord = (db: PGlite, fileName: string): ResultAsync<void, Error> =>
  execSql(
    db,
    `INSERT INTO _ordine_migrations (name) VALUES (${quoteSqlLiteral(fileName)})`,
    `Failed to record migration "${fileName}"`,
  );

const okVoidAsync = (): ResultAsync<void, Error> =>
  ResultAsync.fromSafePromise(
    Promise.resolve(ok(undefined as void)) as Promise<NeverthrowResult<void, Error>>,
  ).andThen((result) => result);

const applyPendingMigrations = (
  db: PGlite,
  migrationsDir: string,
  pendingFiles: string[],
): ResultAsync<number, Error> =>
  pendingFiles
    .reduce<ResultAsync<void, Error>>(
      (chain, fileName) =>
        chain.andThen(() => {
          const contentResult = readMigrationFile(migrationsDir, fileName);
          if (contentResult.isErr()) {
            return ResultAsync.fromSafePromise(
              Promise.resolve(err(contentResult.error)) as Promise<NeverthrowResult<void, Error>>,
            ).andThen((result) => result);
          }

          const statements = contentResult.value
            .split("--> statement-breakpoint")
            .map((statement) => statement.trim())
            .filter((statement) => statement.length > 0);

          const statementChain = statements.reduce<ResultAsync<void, Error>>(
            (currentChain, statement) =>
              currentChain.andThen(() =>
                execSql(db, statement, `Failed to execute migration statement in "${fileName}"`),
              ),
            okVoidAsync(),
          );

          return statementChain.andThen(() => insertMigrationRecord(db, fileName));
        }),
      okVoidAsync(),
    )
    .map(() => pendingFiles.length);

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
  flattenAsyncResult(
    (async () => {
      const trackingTableResult = await execSql(
        db,
        `
        CREATE TABLE IF NOT EXISTS _ordine_migrations (
          id serial PRIMARY KEY,
          name text NOT NULL UNIQUE,
          applied_at timestamp DEFAULT now() NOT NULL
        )
      `,
        "Failed to create migrations tracking table",
      );
      if (trackingTableResult.isErr()) {
        return err(trackingTableResult.error);
      }

      const appliedResult = await queryRows<{ name: string }>(
        db,
        `SELECT name FROM _ordine_migrations`,
        "Failed to query applied migrations",
      );
      if (appliedResult.isErr()) {
        return err(appliedResult.error);
      }

      const appliedSet = new Set(appliedResult.value.rows.map((row) => row.name));
      const filesResult = readMigrationFiles(migrationsDir);
      if (filesResult.isErr()) {
        return err(filesResult.error);
      }

      const files = filesResult.value;
      if (files.length === 0) {
        return ok(0);
      }

      if (appliedSet.size === 0) {
        const tablesResult = await queryRows<{ tablename: string }>(
          db,
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_ordine_migrations'`,
          "Failed to inspect existing schema state",
        );
        if (tablesResult.isErr()) {
          return err(tablesResult.error);
        }

        const existingTableNames = tablesResult.value.rows.map((table) => table.tablename);

        if (existingTableNames.length > 0) {
          const initialMigration = files[0];
          if (!initialMigration) {
            return err(
              new Error(
                "A bootstrap migration file is required to infer existing schema state.",
              ),
            );
          }

          const initialMigrationSqlResult = readMigrationFile(migrationsDir, initialMigration);
          if (initialMigrationSqlResult.isErr()) {
            return err(initialMigrationSqlResult.error);
          }

          const expectedTables = extractCreatedTableNames(initialMigrationSqlResult.value);
          const schemaCoverage = classifySchemaCoverage(existingTableNames, expectedTables);

          if (schemaCoverage === "partial") {
            return err(
              new Error(
                "Detected a partially initialized database without migration tracking. Remove the data directory or restore a complete database before rerunning onboarding.",
              ),
            );
          }

          if (schemaCoverage === "complete") {
            const recordResult = await insertMigrationRecord(db, initialMigration);
            if (recordResult.isErr()) {
              return err(recordResult.error);
            }
            appliedSet.add(initialMigration);
          }
        }
      }

      const pendingFiles = files.filter((fileName) => !appliedSet.has(fileName));
      const applyResult = await applyPendingMigrations(db, migrationsDir, pendingFiles);

      return applyResult.isOk() ? ok(applyResult.value) : err(applyResult.error);
    })(),
  );
