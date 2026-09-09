import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { ResultAsync } from "neverthrow";
import postgres, { type TransactionSql } from "postgres";

export type ExecutionDatabaseErrorCode =
  | "invalid_configuration"
  | "migration_unavailable"
  | "schema_not_initialized"
  | "schema_conflict"
  | "migration_mismatch"
  | "initialization_failed"
  | "database_unavailable";

const messages: Record<ExecutionDatabaseErrorCode, string> = {
  invalid_configuration: "An explicit PostgreSQL URL and a valid execution schema are required.",
  migration_unavailable: "The controlled execution migration could not be loaded or validated.",
  schema_not_initialized: "The execution schema has not been initialized.",
  schema_conflict: "The target schema contains existing or damaged objects and cannot be adopted.",
  migration_mismatch: "The execution schema version or migration checksum does not match.",
  initialization_failed: "The execution migration failed and was rolled back.",
  database_unavailable: "The execution database is unavailable.",
};

/** Safe for API/log presentation: never includes credentials, SQL, paths, or a driver cause. */
export class ExecutionDatabaseError extends Error {
  readonly code: ExecutionDatabaseErrorCode;

  constructor(code: ExecutionDatabaseErrorCode) {
    super(messages[code]);
    this.name = "ExecutionDatabaseError";
    this.code = code;
  }
}

export interface CreateExecutionDatabaseOptions {
  url: string;
  schema?: string;
  initialize: boolean;
  /** Trusted application-owned absolute SQL file path, e.g. a packaged Desktop resource. */
  migrationPath?: string;
}

export interface ExecutionDatabase {
  connection: PostgresJsDatabase<Record<string, unknown>>;
  close(): Promise<void>;
  probe(): Promise<{ reachable: boolean; schemaVersion: number | null }>;
}

const VERSION = 2;
const META = "execution_schema_meta";
const TABLES = [
  "execution_approvals",
  "execution_artifacts",
  "execution_events",
  "execution_input_assets",
  "execution_jobs",
  "execution_node_attempts",
  "execution_operation_heads",
  "execution_operation_revisions",
  "execution_pipeline_runs",
  "execution_pipelines",
  "execution_prepared_runs",
  "execution_run_requests",
  "execution_runtime_configs",
  "execution_workspace_settings",
];
const EXPECTED = [...TABLES, META].sort();
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const safeError = (error: unknown): ExecutionDatabaseError =>
  error instanceof ExecutionDatabaseError
    ? error
    : new ExecutionDatabaseError("database_unavailable");

const validateOptions = (options: CreateExecutionDatabaseOptions): string => {
  const schema = options.schema ?? "public";
  // ASCII identifiers, including the PostgreSQL 63-byte bound; pg_* is reserved.
  if (
    !/^[a-z_][a-z0-9_]{0,62}$/.test(schema) ||
    schema.startsWith("pg_") ||
    schema === "information_schema" ||
    typeof options.initialize !== "boolean" ||
    !options.url ||
    (options.migrationPath !== undefined && !isAbsolute(options.migrationPath))
  ) {
    throw new ExecutionDatabaseError("invalid_configuration");
  }
  const parsed = new URL(options.url);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.pathname.length < 2
  ) {
    throw new ExecutionDatabaseError("invalid_configuration");
  }

  return schema;
};

const readMigration = async (path?: string): Promise<{ sql: string; checksum: string }> => {
  const bytes = await readFile(
    path ?? new URL("../../../../apps/create/migrations-v2/0001_execution.sql", import.meta.url),
  );
  const sql = bytes.toString("utf8");
  const names = Array.from(sql.matchAll(/^\s*CREATE TABLE "(execution_[a-z_]+)"/gm), (m) => m[1]);
  if (JSON.stringify(names.sort()) !== JSON.stringify(TABLES)) {
    throw new ExecutionDatabaseError("migration_unavailable");
  }

  return { sql, checksum: sha256(bytes) };
};

const tablesInSchema = async (sql: TransactionSql, schema: string): Promise<string[]> => {
  const rows = await sql<{ name: string; kind: string }[]>`
    SELECT c.relname AS name, c.relkind AS kind FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schema} AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    ORDER BY c.relname`;

  return rows.map((row) => (row.kind === "r" ? row.name : `non-table:${row.name}`));
};

/** Detect accidental DDL damage as well as missing/extra tables, without storing application data. */
const fingerprint = async (sql: TransactionSql, schema: string): Promise<string> => {
  const rows = await sql`
    SELECT c.relname AS name,
      (SELECT jsonb_agg(jsonb_build_array(a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod),
        a.attnotnull, pg_catalog.pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
       FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d
         ON d.adrelid=a.attrelid AND d.adnum=a.attnum
       WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
      (SELECT jsonb_agg(jsonb_build_array(k.conname, pg_catalog.pg_get_constraintdef(k.oid)) ORDER BY k.conname)
       FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid) AS constraints,
      (SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid) ORDER BY ci.relname)
       FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ci ON ci.oid=i.indexrelid
       WHERE i.indrelid=c.oid) AS indexes
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=${schema} AND c.relkind='r' ORDER BY c.relname`;

  return sha256(JSON.stringify([...rows]));
};

const verify = async (sql: TransactionSql, schema: string, checksum: string): Promise<void> => {
  const tables = await tablesInSchema(sql, schema);
  if (JSON.stringify(tables) !== JSON.stringify(EXPECTED)) {
    throw new ExecutionDatabaseError("schema_conflict");
  }
  const marker = await sql<
    { schema_version: number; migration_sha256: string; schema_fingerprint: string }[]
  >`
    SELECT schema_version, migration_sha256, schema_fingerprint FROM ${sql(schema)}.${sql(META)}`;
  if (
    marker.length !== 1 ||
    marker[0]?.schema_version !== VERSION ||
    marker[0]?.migration_sha256 !== checksum
  ) {
    throw new ExecutionDatabaseError("migration_mismatch");
  }
  if (marker[0].schema_fingerprint !== (await fingerprint(sql, schema))) {
    throw new ExecutionDatabaseError("schema_conflict");
  }
};

export const createExecutionDatabase = (
  options: CreateExecutionDatabaseOptions,
): ResultAsync<ExecutionDatabase, ExecutionDatabaseError> =>
  ResultAsync.fromPromise(
    (async (): Promise<ExecutionDatabase> => {
      const validated = await ResultAsync.fromPromise(
        Promise.resolve().then(() => validateOptions(options)),
        () => new ExecutionDatabaseError("invalid_configuration"),
      );
      if (validated.isErr()) throw validated.error;
      const schema = validated.value;
      const migration = await ResultAsync.fromPromise(
        readMigration(options.migrationPath),
        () => new ExecutionDatabaseError("migration_unavailable"),
      );
      if (migration.isErr()) throw migration.error;
      const client = postgres(options.url, {
        max: 5,
        connect_timeout: 5,
        connection: { search_path: `"${schema}"` },
        onnotice: () => {},
      });
      const initialized = await ResultAsync.fromPromise(
        client.begin(async (sql) => {
          // Per-database/schema transaction lock serializes first creation and all marker checks.
          await sql`SELECT pg_catalog.pg_advisory_xact_lock(1330790985, pg_catalog.hashtext(${schema}))`;
          const tables = await tablesInSchema(sql, schema);
          if (tables.length > 0) {
            if (!tables.includes(META)) throw new ExecutionDatabaseError("schema_conflict");
            await verify(sql, schema, migration.value.checksum);

            return;
          }
          if (!options.initialize) throw new ExecutionDatabaseError("schema_not_initialized");
          const occupied = await sql`SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${schema}
            UNION ALL SELECT 1 FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=${schema}
            UNION ALL SELECT 1 FROM pg_catalog.pg_type t
            JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=${schema}
            LIMIT 1`;
          if (occupied.length > 0) throw new ExecutionDatabaseError("schema_conflict");
          const exists = await sql`SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=${schema}`;
          if (exists.length === 0) await sql`CREATE SCHEMA ${sql(schema)}`;
          const applied = await ResultAsync.fromPromise(
            (async () => {
              for (const statement of migration.value.sql.split("--> statement-breakpoint")) {
                if (statement.trim()) await sql.unsafe(statement);
              }
              await sql`CREATE TABLE ${sql(schema)}.${sql(META)} (
                singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
                schema_version integer NOT NULL,
                migration_sha256 text NOT NULL CHECK (length(migration_sha256)=64),
                schema_fingerprint text NOT NULL CHECK (length(schema_fingerprint)=64),
                initialized_at timestamptz NOT NULL DEFAULT now())`;
              await sql`INSERT INTO ${sql(schema)}.${sql(META)}
                (schema_version,migration_sha256,schema_fingerprint)
                VALUES (${VERSION},${migration.value.checksum},${await fingerprint(sql, schema)})`;
              await verify(sql, schema, migration.value.checksum);
            })(),
            () => new ExecutionDatabaseError("initialization_failed"),
          );
          if (applied.isErr()) throw applied.error;
        }),
        safeError,
      );
      if (initialized.isErr()) {
        // Preserve the actionable startup error even if cleanup also fails.
        await ResultAsync.fromPromise(client.end({ timeout: 1 }), safeError).match(
          () => undefined,
          () => undefined,
        );
        throw initialized.error;
      }

      return {
        connection: drizzle<Record<string, unknown>>(client),
        close: () => client.end({ timeout: 5 }),
        probe: async () => {
          const reached = await ResultAsync.fromPromise(client`SELECT 1`, safeError);
          if (reached.isErr()) return { reachable: false, schemaVersion: null };
          const valid = await ResultAsync.fromPromise(
            client.begin((sql) => verify(sql, schema, migration.value.checksum)),
            safeError,
          );

          return { reachable: true, schemaVersion: valid.isOk() ? VERSION : null };
        },
      };
    })(),
    safeError,
  );
