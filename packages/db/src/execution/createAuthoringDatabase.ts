import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { ResultAsync } from "neverthrow";
import postgres, { type TransactionSql } from "postgres";

const checksum = (content: string) => createHash("sha256").update(content).digest("hex");
const safeError = () =>
  new Error(
    "Authoring database initialization failed. Check the dedicated schema and packaged migrations; existing data was not adopted.",
  );
export const authoringSchemaFor = (executionSchema: string) =>
  `ordine_authoring_${checksum(executionSchema).slice(0, 16)}`;
const fingerprint = async (sql: TransactionSql, schema: string) => {
  const rows =
    await sql`SELECT c.relname, a.attnum, a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull,
    pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_value,
    (SELECT jsonb_agg(pg_catalog.pg_get_constraintdef(k.oid) ORDER BY k.conname) FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid) AS constraints
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname=${schema} AND c.relkind='r' ORDER BY c.relname,a.attnum`;

  return checksum(JSON.stringify(rows));
};

/** Fresh authoring metadata is isolated from execution tables and existing public data. */
export const initializeAuthoringDatabase = (options: {
  url: string;
  schema: string;
  initialize: boolean;
  migrationsDirectory: string;
}) =>
  ResultAsync.fromPromise(
    (async () => {
      if (
        !/^ordine_authoring_[a-f0-9]{16}$/u.test(options.schema) ||
        !isAbsolute(options.migrationsDirectory)
      )
        throw safeError();
      const names = (await readdir(options.migrationsDirectory))
        .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/u.test(name))
        .sort();
      if (names.length !== 14 || !names[0]!.startsWith("0000_") || !names[13]!.startsWith("0013_"))
        throw safeError();
      const sources = await Promise.all(
        names.map(
          async (name) =>
            `${name}\n${await readFile(join(options.migrationsDirectory, name), "utf8")}`,
        ),
      );
      const hash = checksum(sources.join("\n"));
      const sqlSources = sources.map((source) => source.slice(source.indexOf("\n") + 1));
      const expectedTables = [
        ...new Set(
          sqlSources.flatMap((source) =>
            [...source.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([a-z_]+)"/gu)].map(
              (match) => match[1]!,
            ),
          ),
        ),
      ].sort();
      if (
        !expectedTables.includes("pipelines") ||
        !expectedTables.includes("agent_runs") ||
        !expectedTables.includes("agent_actions")
      )
        throw safeError();
      const client = postgres(options.url, {
        max: 1,
        connect_timeout: 10,
        connection: { search_path: options.schema },
        onnotice: () => undefined,
      });
      const migrated = await ResultAsync.fromPromise(
        client.begin(async (sql) => {
          await sql`SELECT pg_catalog.pg_advisory_xact_lock(1330790986, pg_catalog.hashtext(${options.schema}))`;
          const rows = await sql<
            { name: string }[]
          >`SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname=${options.schema} ORDER BY tablename`;
          if (rows.length > 0) {
            if (
              JSON.stringify(rows.map((row) => row.name)) !==
              JSON.stringify([...expectedTables, "authoring_schema_meta"].sort())
            )
              throw safeError();
            const metadata = await sql<
              { migration_sha256: string; schema_fingerprint: string }[]
            >`SELECT migration_sha256,schema_fingerprint FROM ${sql(options.schema)}.authoring_schema_meta WHERE singleton=true`;
            if (
              metadata.length !== 1 ||
              metadata[0]!.migration_sha256 !== hash ||
              metadata[0]!.schema_fingerprint !== (await fingerprint(sql, options.schema))
            )
              throw safeError();

            return;
          }
          if (!options.initialize)
            throw new Error(
              "Authoring metadata is not initialized. Enable initialization for the owned schema before retrying.",
            );
          const occupied =
            await sql`SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${options.schema} LIMIT 1`;
          if (occupied.length) throw safeError();
          await sql`CREATE SCHEMA IF NOT EXISTS ${sql(options.schema)}`;
          for (const source of sqlSources) {
            // These are trusted packaged DDL files. Public FK qualifiers are rebound only inside a fresh private schema.
            const scoped = source.replaceAll('"public".', `"${options.schema}".`);
            for (const statement of scoped.split("--> statement-breakpoint"))
              if (statement.trim()) await sql.unsafe(statement);
          }
          await sql`CREATE TABLE ${sql(options.schema)}.authoring_schema_meta (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), migration_sha256 text NOT NULL, schema_fingerprint text NOT NULL, initialized_at timestamptz NOT NULL DEFAULT now())`;
          await sql`INSERT INTO ${sql(options.schema)}.authoring_schema_meta (migration_sha256,schema_fingerprint) VALUES (${hash},${await fingerprint(sql, options.schema)})`;
        }),
        safeError,
      );
      await client.end({ timeout: 3 });
      if (migrated.isErr()) throw migrated.error;

      return { schema: options.schema, migrationSha256: hash, tableCount: expectedTables.length };
    })(),
    safeError,
  );
