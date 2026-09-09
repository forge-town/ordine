import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Result, ResultAsync } from "neverthrow";
import { createExecutionDatabase } from "@repo/db/execution";
import { createExecutionMigrationRepository } from "@repo/models";
import {
  createExecutionMigrationService,
  migrationBytesSha256,
  parseMigrationJson,
  validateExecutionMigration,
} from "@repo/services/execution-migration";

/** Standalone offline tool. No default source path, DB, schema, workspace or runtime startup. */
export const executionImportMain = async (args: string[]): Promise<number> => {
  const options = Result.fromThrowable(
    () =>
      parseArgs({
        args,
        options: {
          source: { type: "string" },
          bundle: { type: "string" },
          report: { type: "string" },
          workspace: { type: "string" },
          schema: { type: "string" },
          "database-url": { type: "string" },
          "database-url-env": { type: "string" },
          import: { type: "boolean", default: false },
          "confirm-new-workspace": { type: "boolean", default: false },
        },
      }).values,
    () => "invalid_arguments",
  )();
  if (options.isErr()) {
    console.error(options.error);

    return 2;
  }
  const flags = options.value;
  const paths = [flags.source, flags.bundle, flags.report];
  if (
    paths.some((path) => !path || !isAbsolute(path)) ||
    new Set(paths.map((path) => resolve(path!).toLowerCase())).size !== 3 ||
    !flags.workspace
  ) {
    console.error(
      "Explicit, distinct absolute --source --bundle --report and --workspace are required.",
    );

    return 2;
  }
  const loaded = await ResultAsync.fromPromise(
    Promise.all([readFile(flags.source!), readFile(flags.bundle!)]),
    () => "input_read_failed",
  );
  if (loaded.isErr()) {
    console.error(loaded.error);

    return 2;
  }
  const [source, bundleBytes] = loaded.value;
  if (bundleBytes.byteLength > 32 * 1024 * 1024) {
    console.error("bundle_too_large");

    return 2;
  }
  const bundle = parseMigrationJson(bundleBytes);
  if (bundle.isErr()) {
    console.error(bundle.error.code);

    return 2;
  }
  const validated = validateExecutionMigration(bundle.value, source);
  const saveReport = async (report: unknown) =>
    ResultAsync.fromPromise(
      writeFile(flags.report!, `${JSON.stringify(report, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      }),
      () => "report_write_failed_or_exists",
    );
  if (validated.isErr()) {
    const written = await saveReport({
      valid: false,
      imported: false,
      sourceSha256: migrationBytesSha256(source),
      bundleFileSha256: migrationBytesSha256(bundleBytes),
      code: validated.error.code,
      objectIndex: validated.error.objectIndex,
    });
    console.error(written.isErr() ? written.error : validated.error.code);

    return 1;
  }
  if (flags.workspace !== validated.value.bundle.targetWorkspaceId) {
    console.error("workspace_mismatch");

    return 2;
  }
  const report = {
    ...validated.value.report,
    bundleFileSha256: migrationBytesSha256(bundleBytes),
    imported: false,
  };
  if (!flags.import) {
    const written = await saveReport(report);
    console.log(
      written.isErr() ? written.error : "Offline bundle validated. No database was opened.",
    );

    return written.isErr() ? 2 : 0;
  }
  const url = flags["database-url-env"]
    ? process.env[flags["database-url-env"]]
    : flags["database-url"];
  if (
    !flags["confirm-new-workspace"] ||
    !flags.schema ||
    !/^[a-z_][a-z0-9_]{0,62}$/.test(flags.schema) ||
    flags.schema === "public" ||
    flags.schema.startsWith("pg_") ||
    !url ||
    (flags["database-url-env"] && flags["database-url"])
  ) {
    console.error(
      "Explicit new schema, one database URL source, and --confirm-new-workspace are required.",
    );

    return 2;
  }
  // Reserve the audit path before any database writes. Never overwrite a source, bundle or earlier report.
  const reserved = await saveReport({
    ...report,
    state: "import_pending",
    targetSchema: flags.schema,
  });
  if (reserved.isErr()) {
    console.error(reserved.error);

    return 2;
  }
  const rejectImport = async (code: string) => {
    const written = await ResultAsync.fromPromise(
      writeFile(
        flags.report!,
        `${JSON.stringify({ ...report, state: "rejected", targetSchema: flags.schema, code }, null, 2)}\n`,
        "utf8",
      ),
      () => "report_finalize_failed",
    );
    console.error(written.isErr() ? written.error : code);

    return 1;
  };
  const migrationPath = fileURLToPath(
    new URL("../migrations-v2/0001_execution.sql", import.meta.url),
  );
  const migration = await ResultAsync.fromPromise(
    readFile(migrationPath),
    () => "migration_read_failed",
  );
  if (migration.isErr()) return rejectImport(migration.error);
  const opened = await createExecutionDatabase({
    url,
    schema: flags.schema,
    initialize: true,
    migrationPath,
  });
  if (opened.isErr()) return rejectImport(opened.error.code);
  const database = opened.value;
  const service = createExecutionMigrationService({
    repository: createExecutionMigrationRepository({
      db: database.connection,
      schema: flags.schema,
      migrationSha256: migrationBytesSha256(migration.value),
    }),
  });
  const imported = await service.importBundle(bundle.value, source);
  const closed = await ResultAsync.fromPromise(database.close(), () => "database_close_failed");
  const result = imported.isOk()
    ? {
        ...imported.value,
        bundleFileSha256: migrationBytesSha256(bundleBytes),
        targetSchema: flags.schema,
        state: "committed",
        connectionClosed: closed.isOk(),
      }
    : { ...report, targetSchema: flags.schema, state: "rejected", code: imported.error.code };
  const written = await ResultAsync.fromPromise(
    writeFile(flags.report!, `${JSON.stringify(result, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    }),
    () => "report_finalize_failed",
  );
  console.log(
    written.isErr()
      ? written.error
      : imported.isOk()
        ? "Offline definitions atomically imported. See the explicit report path."
        : imported.error.code,
  );

  return imported.isErr() || written.isErr() || closed.isErr() ? 1 : 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await executionImportMain(process.argv.slice(2));
