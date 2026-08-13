import { PGlite } from "@electric-sql/pglite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = join(import.meta.dirname, "../../../..");
const migrationsDir = join(rootDir, "apps/create/migrations");
const pgliteMigration = join(migrationsDir, "0003_harvest_capabilities.sql");
const postgresMigration = join(rootDir, "apps/app/drizzle/0030_harvest_capabilities.sql");
const postgresJournal = join(rootDir, "apps/app/drizzle/meta/_journal.json");

const applyMigrations = async (db: PGlite, upTo?: string) => {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (upTo && file > upTo) continue;
    const statements = readFileSync(join(migrationsDir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.exec(statement);
    }
  }
};

describe("COD-339 migration", () => {
  it("keeps PGlite and Postgres migrations identical and journaled", () => {
    expect(existsSync(pgliteMigration), "COD-339 PGlite migration file must exist").toBe(true);
    expect(readFileSync(pgliteMigration, "utf8")).toBe(readFileSync(postgresMigration, "utf8"));
    const journal = JSON.parse(readFileSync(postgresJournal, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(journal.entries.at(-1)).toMatchObject({
      idx: 30,
      tag: "0030_harvest_capabilities",
    });
  });

  it("adds provenance and encrypted credential columns plus the signature index", async () => {
    const db = new PGlite();
    await applyMigrations(db);

    const columns = await db.query<{ column_name: string; table_name: string }>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_name IN ('connectors', 'skills')
    `);
    const names = columns.rows.map((row) => `${row.table_name}.${row.column_name}`);

    expect(names).toEqual(
      expect.arrayContaining([
        "connectors.origin",
        "connectors.signature",
        "connectors.sources",
        "connectors.encrypted_credentials",
        "skills.origin",
        "skills.sources",
      ]),
    );
    const indexes = await db.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes WHERE indexname = 'connectors_signature_idx'
    `);
    expect(indexes.rows).toHaveLength(1);

    await db.close();
  });

  it("backfills existing manual rows without changing their public configuration", async () => {
    const db = new PGlite();
    await applyMigrations(db, "0002_routines_claude_spec.sql");
    await db.exec(`
      INSERT INTO "connectors" ("id", "name", "method", "config")
        VALUES ('manual-mcp', 'Manual MCP', 'mcp', '{"transport":"stdio","command":"npx"}'::jsonb);
      INSERT INTO "skills" ("id", "name", "label", "description", "category")
        VALUES ('manual-skill', 'manual-skill', 'Manual Skill', 'Description', 'manual');
    `);
    const migration = readFileSync(pgliteMigration, "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of migration) await db.exec(statement);

    const connectors = await db.query<{
      config: unknown;
      encrypted_credentials: unknown;
      origin: string;
      sources: unknown;
    }>(`SELECT config, encrypted_credentials, origin, sources FROM connectors`);
    expect(connectors.rows).toEqual([
      {
        config: { transport: "stdio", command: "npx" },
        encrypted_credentials: {},
        origin: "manual",
        sources: [],
      },
    ]);
    const skills = await db.query<{ origin: string; sources: unknown }>(
      `SELECT origin, sources FROM skills WHERE id = 'manual-skill'`,
    );
    expect(skills.rows).toEqual([{ origin: "manual", sources: [] }]);

    await db.close();
  });
});
