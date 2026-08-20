import postgres from "postgres";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const rootDir = join(import.meta.dirname, "../../../..");
const migrationsDir = join(rootDir, "apps/create/migrations");
const migration = join(migrationsDir, "0002_routines_claude_spec.sql");
const postgresMigration = join(rootDir, "apps/app/drizzle/0029_routines_claude_spec.sql");
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

const applyMigrations = async (
  db: ReturnType<typeof postgres>,
  range?: { after?: string; upTo?: string },
) => {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (range?.after && file <= range.after) continue;
    if (range?.upTo && file > range.upTo) continue;
    const statements = readFileSync(join(migrationsDir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.unsafe(statement);
    }
  }
};

const routineColumns = async (db: ReturnType<typeof postgres>) => {
  const columns = await db.unsafe<{ column_name: string }[]>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'routines'
    `);

  return columns.map((row) => row.column_name);
};

describe("COD-244 migration", () => {
  it("keeps the migration files identical and journaled", () => {
    expect(existsSync(migration), "COD-244 migration file must exist").toBe(true);
    expect(readFileSync(migration, "utf8")).toBe(readFileSync(postgresMigration, "utf8"));
    const journal = JSON.parse(readFileSync(postgresJournal, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(
      journal.entries.find((entry) => entry.tag === "0029_routines_claude_spec"),
    ).toMatchObject({
      idx: 29,
      tag: "0029_routines_claude_spec",
    });
  });

  it("adds description and removes the event trigger columns", async () => {
    const db = postgres(databaseUrl, { onnotice: () => {} });
    await applyMigrations(db);

    const columns = await routineColumns(db);
    expect(columns).toContain("description");
    expect(columns).not.toContain("trigger_type");
    expect(columns).not.toContain("event_type");
    expect(columns).not.toContain("event_config");

    await db.end();
  });

  it("drops legacy event routines and keeps cron routines intact", async () => {
    const db = postgres(databaseUrl, { onnotice: () => {} });
    await applyMigrations(db, { upTo: "0001_add_ordine_domain_tables.sql" });

    await db.unsafe(`
      INSERT INTO "pipelines" ("id", "name") VALUES ('pipeline-1', 'Pipeline');
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression")
        VALUES ('routine-cron', 'pipeline-1', 'Cron routine', 'cron', '0 9 * * 1-5');
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "event_type")
        VALUES ('routine-event', 'pipeline-1', 'Event routine', 'event', 'webhook');
    `);

    await applyMigrations(db, { after: "0001_add_ordine_domain_tables.sql" });

    const rows = await db.unsafe<{ id: string; description: string | null }[]>(
      `SELECT id, description FROM "routines" ORDER BY id`,
    );
    expect(rows).toEqual([{ id: "routine-cron", description: null }]);

    await db.end();
  });

  it("disables routines with cron expressions the new parser cannot parse", async () => {
    const db = postgres(databaseUrl, { onnotice: () => {} });
    await applyMigrations(db, { upTo: "0001_add_ordine_domain_tables.sql" });

    await db.unsafe(`
      INSERT INTO "pipelines" ("id", "name") VALUES ('pipeline-1', 'Pipeline');
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression", "enabled")
        VALUES ('routine-valid', 'pipeline-1', 'Valid', 'cron', '0 9 * * 1-5', true);
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression", "enabled")
        VALUES ('routine-legacy-l', 'pipeline-1', 'Legacy L', 'cron', '0 9 L * *', true);
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression", "enabled")
        VALUES ('routine-legacy-w', 'pipeline-1', 'Legacy W', 'cron', '0 9 15W * *', true);
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression", "enabled")
        VALUES ('routine-empty', 'pipeline-1', 'Empty', 'cron', '', true);
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression", "enabled")
        VALUES ('routine-step-zero', 'pipeline-1', 'Step zero', 'cron', '*/0 * * * *', true);
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression", "enabled")
        VALUES ('routine-six-field', 'pipeline-1', 'Six field', 'cron', '* * * * * *', true);
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression", "enabled")
        VALUES ('routine-feb-30', 'pipeline-1', 'Feb 30', 'cron', '0 0 30 2 *', true);
    `);

    await applyMigrations(db, { after: "0001_add_ordine_domain_tables.sql" });

    const rows = await db.unsafe<{ id: string; enabled: boolean; next_run_at: string | null }[]>(
      `SELECT id, enabled, next_run_at FROM "routines" ORDER BY id`,
    );
    expect(rows).toEqual([
      { id: "routine-empty", enabled: false, next_run_at: null },
      { id: "routine-feb-30", enabled: false, next_run_at: null },
      { id: "routine-legacy-l", enabled: false, next_run_at: null },
      { id: "routine-legacy-w", enabled: false, next_run_at: null },
      { id: "routine-six-field", enabled: false, next_run_at: null },
      { id: "routine-step-zero", enabled: false, next_run_at: null },
      { id: "routine-valid", enabled: true, next_run_at: null },
    ]);

    await db.end();
  });
});
