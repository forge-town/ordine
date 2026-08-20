import { err, ok, Result, ResultAsync, type Result as NeverthrowResult } from "neverthrow";
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type SchemaCoverage = "complete" | "empty" | "partial";

const MIGRATION_LOCK_NAMESPACE = 1_330_790_985;
const MIGRATION_LOCK_ID = 351;

const flattenAsyncResult = <T>(
  promise: Promise<NeverthrowResult<T, Error>>,
): ResultAsync<T, Error> => ResultAsync.fromSafePromise(promise).andThen((result) => result);

const toError = (error: unknown, prefix: string): Error =>
  new Error(`${prefix}: ${error instanceof Error ? error.message : String(error)}`);

const readMigrationFiles = (migrationsDir: string): Result<string[], Error> =>
  Result.fromThrowable(
    () =>
      readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort(),
    (error) => toError(error, "Failed to read migration directory"),
  )();

const readMigrationFile = (migrationsDir: string, fileName: string): Result<string, Error> =>
  Result.fromThrowable(
    () => readFileSync(join(migrationsDir, fileName), "utf8"),
    (error) => toError(error, `Failed to read migration file "${fileName}"`),
  )();

export const extractCreatedTableNames = (sql: string): string[] =>
  Array.from(sql.matchAll(/^\s*CREATE TABLE "([^"]+)"/gm), (match) => match[1]).filter(
    (tableName): tableName is string => typeof tableName === "string",
  );

export const classifySchemaCoverage = (
  existingTables: string[],
  expectedTables: string[],
): SchemaCoverage => {
  const existingSet = new Set(
    existingTables.filter((tableName) => tableName !== "_ordine_migrations"),
  );
  if (existingSet.size === 0) return "empty";

  return expectedTables.every((tableName) => existingSet.has(tableName)) ? "complete" : "partial";
};

export const runMigrations = (
  connectionString: string,
  migrationsDir: string,
): ResultAsync<number, Error> =>
  flattenAsyncResult(
    (() => {
      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      const lockState = { acquired: false };

      const finalize = async (
        result: NeverthrowResult<number, Error>,
      ): Promise<NeverthrowResult<number, Error>> => {
        const unlockResult = lockState.acquired
          ? await ResultAsync.fromPromise(
              sql.unsafe(
                `SELECT pg_advisory_unlock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_ID})`,
              ),
              (error) => toError(error, "Failed to release migration lock"),
            )
          : ok(undefined);
        const closeResult = await ResultAsync.fromPromise(sql.end({ timeout: 5 }), (error) =>
          toError(error, "Failed to close PostgreSQL connection"),
        );

        if (result.isErr()) return result;
        if (unlockResult.isErr()) return err(unlockResult.error);
        if (closeResult.isErr()) return err(closeResult.error);

        return result;
      };

      const execute = async (): Promise<NeverthrowResult<number, Error>> => {
        const lockResult = await ResultAsync.fromPromise(
          sql.unsafe(`SELECT pg_advisory_lock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_ID})`),
          (error) => toError(error, "Failed to acquire migration lock"),
        );
        if (lockResult.isErr()) return err(lockResult.error);
        lockState.acquired = true;

        const trackingResult = await ResultAsync.fromPromise(
          sql.unsafe(`
          CREATE TABLE IF NOT EXISTS _ordine_migrations (
            id serial PRIMARY KEY,
            name text NOT NULL UNIQUE,
            applied_at timestamp DEFAULT now() NOT NULL
          )
        `),
          (error) => toError(error, "Failed to create migrations tracking table"),
        );
        if (trackingResult.isErr()) return err(trackingResult.error);

        const appliedResult = await ResultAsync.fromPromise(
          sql.unsafe<{ name: string }[]>("SELECT name FROM _ordine_migrations"),
          (error) => toError(error, "Failed to query applied migrations"),
        );
        if (appliedResult.isErr()) return err(appliedResult.error);

        const filesResult = readMigrationFiles(migrationsDir);
        if (filesResult.isErr()) return err(filesResult.error);

        const files = filesResult.value;
        const appliedSet = new Set(appliedResult.value.map(({ name }) => name));
        if (files.length === 0) return ok(0);

        if (appliedSet.size === 0) {
          const tablesResult = await ResultAsync.fromPromise(
            sql.unsafe<{ tablename: string }[]>(
              "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_ordine_migrations'",
            ),
            (error) => toError(error, "Failed to inspect existing schema state"),
          );
          if (tablesResult.isErr()) return err(tablesResult.error);

          const existingTableNames = tablesResult.value.map(({ tablename }) => tablename);
          if (existingTableNames.length > 0) {
            const initialMigration = files[0];
            if (!initialMigration) {
              return err(
                new Error("A bootstrap migration file is required to infer existing schema state."),
              );
            }

            const initialSqlResult = readMigrationFile(migrationsDir, initialMigration);
            if (initialSqlResult.isErr()) return err(initialSqlResult.error);

            const coverage = classifySchemaCoverage(
              existingTableNames,
              extractCreatedTableNames(initialSqlResult.value),
            );
            if (coverage === "partial") {
              return err(
                new Error(
                  "Detected a partially initialized database without migration tracking. Remove the database or restore a complete schema before rerunning onboarding.",
                ),
              );
            }

            if (coverage === "complete") {
              const recordResult = await ResultAsync.fromPromise(
                sql`INSERT INTO _ordine_migrations (name) VALUES (${initialMigration})`,
                (error) => toError(error, `Failed to record migration "${initialMigration}"`),
              );
              if (recordResult.isErr()) return err(recordResult.error);

              appliedSet.add(initialMigration);
            }
          }
        }

        const pending = files.filter((file) => !appliedSet.has(file));
        for (const file of pending) {
          const contentResult = readMigrationFile(migrationsDir, file);
          if (contentResult.isErr()) return err(contentResult.error);

          const statements = contentResult.value
            .split("--> statement-breakpoint")
            .map((statement) => statement.trim())
            .filter(Boolean);
          const migrationResult = await ResultAsync.fromPromise(
            sql.begin(async (transaction) => {
              for (const statement of statements) {
                await transaction.unsafe(statement);
              }
              await transaction`INSERT INTO _ordine_migrations (name) VALUES (${file})`;
            }),
            (error) => toError(error, `Failed to execute migration transaction in "${file}"`),
          );
          if (migrationResult.isErr()) return err(migrationResult.error);
        }

        return ok(pending.length);
      };

      return execute().then(
        (result) => finalize(result),
        (error) => finalize(err(toError(error, "Unexpected migration failure"))),
      );
    })(),
  );
