import postgres from "postgres";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const rootDir = join(import.meta.dirname, "../../../..");
const migrationsDir = join(rootDir, "apps/create/migrations");
const migration = join(migrationsDir, "0001_add_ordine_domain_tables.sql");
const postgresMigration = join(rootDir, "apps/app/drizzle/0028_add_ordine_domain_tables.sql");
const postgresJournal = join(rootDir, "apps/app/drizzle/meta/_journal.json");
const testDatabaseUrl = new URL(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ordine",
);
testDatabaseUrl.pathname = "/ordine_db_schema_test";
const databaseUrl = process.env.ORDINE_DB_SCHEMA_TEST_DATABASE_URL ?? testDatabaseUrl.toString();

beforeEach(async () => {
  const db = postgres(databaseUrl, { onnotice: () => {} });
  await db.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await db.end();
});

const applyMigrations = async (db: ReturnType<typeof postgres>) => {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const statements = readFileSync(join(migrationsDir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.unsafe(statement);
    }
  }
};

describe("COD-115 migration", () => {
  it("applies the complete migration chain to an empty database", async () => {
    expect(existsSync(migration), "COD-115 migration file must exist").toBe(true);
    expect(readFileSync(migration, "utf8")).toBe(readFileSync(postgresMigration, "utf8"));
    const journal = JSON.parse(readFileSync(postgresJournal, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(journal.entries.find((entry) => entry.idx === 28)).toMatchObject({
      idx: 28,
      tag: "0028_add_ordine_domain_tables",
    });

    const db = postgres(databaseUrl, { onnotice: () => {} });
    await applyMigrations(db);

    const tables = await db.unsafe<{ table_name: string }[]>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);
    expect(tables.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "projects",
        "conversation_messages",
        "routines",
        "connectors",
        "pipeline_assets",
      ]),
    );

    const columns = await db.unsafe<{ column_name: string; table_name: string }[]>(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_name IN ('pipelines', 'jobs')
      `);
    const columnNamesFor = (tableName: string) =>
      columns.filter((row) => row.table_name === tableName).map((row) => row.column_name);
    expect(columnNamesFor("pipelines")).toEqual(
      expect.arrayContaining(["project_id", "status", "version"]),
    );
    expect(columnNamesFor("jobs")).toEqual(
      expect.arrayContaining([
        "pipeline_id",
        "project_id",
        "total_tokens",
        "triggered_by",
        "node_statuses",
      ]),
    );

    await db.end();
  });
});
