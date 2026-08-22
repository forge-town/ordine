import postgres from "postgres";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { classifySchemaCoverage, extractCreatedTableNames, runMigrations } from "../src/migrations";

const migrationsDir = join(import.meta.dirname, "../migrations");
const historicalMigrationsDir = join(import.meta.dirname, "fixtures");

const databaseUrl = new URL(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ordine",
);
databaseUrl.pathname = "/ordine_create_test";
const resolvedDatabaseUrl = process.env.ORDINE_CREATE_TEST_DATABASE_URL ?? databaseUrl.toString();

const resetDatabase = async () => {
  const db = postgres(resolvedDatabaseUrl, { onnotice: () => {} });
  await db.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await db.end();
};

beforeEach(async () => {
  await resetDatabase();
});

const applySqlFile = async (
  db: ReturnType<typeof postgres>,
  fileName: string,
  dir: string = migrationsDir,
) => {
  const statements = readFileSync(join(dir, fileName), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.unsafe(statement);
  }
};

describe("extractCreatedTableNames", () => {
  it("reads user table names from migration sql", () => {
    const sql = `
      CREATE TABLE "users" (
        "id" text PRIMARY KEY
      );
      --> statement-breakpoint
      CREATE TABLE "sessions" (
        "id" text PRIMARY KEY
      );
      --> statement-breakpoint
      CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");
    `;

    expect(extractCreatedTableNames(sql)).toEqual(["users", "sessions"]);
  });
});

describe("classifySchemaCoverage", () => {
  it("treats a database with no user tables as empty", () => {
    expect(classifySchemaCoverage([], ["users", "sessions"])).toBe("empty");
  });

  it("treats a database with every expected table as complete", () => {
    expect(classifySchemaCoverage(["users", "sessions"], ["users", "sessions"])).toBe("complete");
  });

  it("treats a database with only some expected tables as partial", () => {
    expect(classifySchemaCoverage(["users"], ["users", "sessions"])).toBe("partial");
  });
});

describe("runMigrations", () => {
  it("rejects a partially initialized real PostgreSQL schema", async () => {
    const db = postgres(resolvedDatabaseUrl, { onnotice: () => {} });
    await db.unsafe(`CREATE TABLE "users" ("id" text PRIMARY KEY NOT NULL)`);

    const result = await runMigrations(resolvedDatabaseUrl, migrationsDir);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("partially initialized database");
    const applied = await db.unsafe<{ name: string }[]>(`SELECT name FROM _ordine_migrations`);
    expect(applied).toHaveLength(0);
    await db.end();
  });

  it("serializes concurrent migration runners with a PostgreSQL advisory lock", async () => {
    const [first, second] = await Promise.all([
      runMigrations(resolvedDatabaseUrl, migrationsDir),
      runMigrations(resolvedDatabaseUrl, migrationsDir),
    ]);

    expect(first.isOk()).toBe(true);
    expect(second.isOk()).toBe(true);
    expect([first._unsafeUnwrap(), second._unsafeUnwrap()].sort((a, b) => a - b)).toEqual([0, 10]);

    const db = postgres(resolvedDatabaseUrl, { onnotice: () => {} });
    const applied = await db.unsafe<{ name: string }[]>(
      `SELECT name FROM _ordine_migrations ORDER BY name`,
    );
    expect(applied).toHaveLength(10);
    await db.end();
  });

  it("upgrades a complete legacy schema without migration tracking", async () => {
    const db = postgres(resolvedDatabaseUrl, { onnotice: () => {} });
    await applySqlFile(db, "0000_init.sql");

    const result = await runMigrations(resolvedDatabaseUrl, migrationsDir);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(9);
    const migrations = await db.unsafe<{ name: string }[]>(
      `SELECT name FROM _ordine_migrations ORDER BY name`,
    );
    expect(migrations.map(({ name }) => name)).toEqual([
      "0000_init.sql",
      "0001_add_ordine_domain_tables.sql",
      "0002_routines_claude_spec.sql",
      "0003_harvest_capabilities.sql",
      "0004_add_agent_default_model.sql",
      "0005_capability_risk_overrides.sql",
      "0006_add_pipeline_agent_session_tables.sql",
      "0007_agent_runs.sql",
      "0008_agent_execution_preferences.sql",
      "0009_default_agent_full_access.sql",
    ]);
    const projects = await db.unsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'projects'`,
    );
    expect(projects).toHaveLength(1);

    await db.end();
  });

  it("upgrades from the real historical 0000_init.sql and backfills missing columns", async () => {
    const db = postgres(resolvedDatabaseUrl, { onnotice: () => {} });
    await applySqlFile(db, "0000_init_c10d326d.sql", historicalMigrationsDir);

    const result = await runMigrations(resolvedDatabaseUrl, migrationsDir);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(9);

    const migrations = await db.unsafe<{ name: string }[]>(
      `SELECT name FROM _ordine_migrations ORDER BY name`,
    );
    expect(migrations.map(({ name }) => name)).toEqual([
      "0000_init.sql",
      "0001_add_ordine_domain_tables.sql",
      "0002_routines_claude_spec.sql",
      "0003_harvest_capabilities.sql",
      "0004_add_agent_default_model.sql",
      "0005_capability_risk_overrides.sql",
      "0006_add_pipeline_agent_session_tables.sql",
      "0007_agent_runs.sql",
      "0008_agent_execution_preferences.sql",
      "0009_default_agent_full_access.sql",
    ]);

    const columns = await db.unsafe<{ column_name: string; table_name: string }[]>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE (table_name = 'operations' AND column_name = 'source_skill_id')
          OR (table_name = 'pipelines' AND column_name = 'shared_context')`,
    );
    const columnNames = columns.map((row) => `${row.table_name}.${row.column_name}`);
    expect(columnNames).toContain("operations.source_skill_id");
    expect(columnNames).toContain("pipelines.shared_context");

    await db.end();
  });

  it("rolls back a failed migration file atomically and allows retry", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "ordine-migrations-"));
    const initSql = readFileSync(join(migrationsDir, "0000_init.sql"), "utf8");
    writeFileSync(join(tmpDir, "0000_init.sql"), initSql);
    writeFileSync(
      join(tmpDir, "0001_bad.sql"),
      `CREATE TABLE "bad_table" ("id" text PRIMARY KEY NOT NULL);\n--> statement-breakpoint\nTHIS_IS_INVALID_SQL;`,
    );

    const db = postgres(resolvedDatabaseUrl, { onnotice: () => {} });
    const badResult = await runMigrations(resolvedDatabaseUrl, tmpDir);
    expect(badResult.isErr()).toBe(true);

    const tablesAfterFailure = await db.unsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'bad_table'`,
    );
    expect(tablesAfterFailure).toHaveLength(0);

    const recordsAfterFailure = await db.unsafe<{ name: string }[]>(
      `SELECT name FROM _ordine_migrations WHERE name = '0001_bad.sql'`,
    );
    expect(recordsAfterFailure).toHaveLength(0);

    writeFileSync(
      join(tmpDir, "0001_bad.sql"),
      `CREATE TABLE "bad_table" ("id" text PRIMARY KEY NOT NULL);`,
    );

    const goodResult = await runMigrations(resolvedDatabaseUrl, tmpDir);
    expect(goodResult.isOk()).toBe(true);

    const tablesAfterRetry = await db.unsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'bad_table'`,
    );
    expect(tablesAfterRetry).toHaveLength(1);

    await db.end();
  });
});
