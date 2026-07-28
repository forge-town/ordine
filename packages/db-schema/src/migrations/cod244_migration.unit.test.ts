import { PGlite } from "@electric-sql/pglite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = join(import.meta.dirname, "../../../..");
const migrationsDir = join(rootDir, "apps/create/migrations");
const pgliteMigration = join(migrationsDir, "0002_routines_claude_spec.sql");
const postgresMigration = join(rootDir, "apps/app/drizzle/0029_routines_claude_spec.sql");
const postgresJournal = join(rootDir, "apps/app/drizzle/meta/_journal.json");

const applyMigrations = async (db: PGlite, range?: { after?: string; upTo?: string }) => {
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
      await db.exec(statement);
    }
  }
};

const routineColumns = async (db: PGlite) => {
  const columns = await db.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'routines'
    `);

  return columns.rows.map((row) => row.column_name);
};

describe("COD-244 migration", () => {
  it("keeps the PGlite and Postgres migration files identical and journaled", () => {
    expect(existsSync(pgliteMigration), "COD-244 PGlite migration file must exist").toBe(true);
    expect(readFileSync(pgliteMigration, "utf8")).toBe(readFileSync(postgresMigration, "utf8"));
    const journal = JSON.parse(readFileSync(postgresJournal, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 29,
      tag: "0029_routines_claude_spec",
    });
  });

  it("adds description and removes the event trigger columns", async () => {
    const db = new PGlite();
    await applyMigrations(db);

    const columns = await routineColumns(db);
    expect(columns).toContain("description");
    expect(columns).not.toContain("trigger_type");
    expect(columns).not.toContain("event_type");
    expect(columns).not.toContain("event_config");

    await db.close();
  });

  it("drops legacy event routines and keeps cron routines intact", async () => {
    const db = new PGlite();
    await applyMigrations(db, { upTo: "0001_add_ordine_domain_tables.sql" });

    await db.exec(`
      INSERT INTO "pipelines" ("id", "name") VALUES ('pipeline-1', 'Pipeline');
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "cron_expression")
        VALUES ('routine-cron', 'pipeline-1', 'Cron routine', 'cron', '0 9 * * 1-5');
      INSERT INTO "routines" ("id", "pipeline_id", "name", "trigger_type", "event_type")
        VALUES ('routine-event', 'pipeline-1', 'Event routine', 'event', 'webhook');
    `);

    await applyMigrations(db, { after: "0001_add_ordine_domain_tables.sql" });

    const rows = await db.query<{ id: string; description: string | null }>(
      `SELECT id, description FROM "routines" ORDER BY id`,
    );
    expect(rows.rows).toEqual([{ id: "routine-cron", description: null }]);

    await db.close();
  });

  it("disables routines with cron expressions the new parser cannot parse", async () => {
    const db = new PGlite();
    await applyMigrations(db, { upTo: "0001_add_ordine_domain_tables.sql" });

    await db.exec(`
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

    const rows = await db.query<{ id: string; enabled: boolean; next_run_at: string | null }>(
      `SELECT id, enabled, next_run_at FROM "routines" ORDER BY id`,
    );
    expect(rows.rows).toEqual([
      { id: "routine-empty", enabled: false, next_run_at: null },
      { id: "routine-feb-30", enabled: false, next_run_at: null },
      { id: "routine-legacy-l", enabled: false, next_run_at: null },
      { id: "routine-legacy-w", enabled: false, next_run_at: null },
      { id: "routine-six-field", enabled: false, next_run_at: null },
      { id: "routine-step-zero", enabled: false, next_run_at: null },
      { id: "routine-valid", enabled: true, next_run_at: null },
    ]);

    await db.close();
  });
});
