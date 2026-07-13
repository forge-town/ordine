import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifySchemaCoverage, extractCreatedTableNames, runMigrations } from "../src/migrations";

const migrationsDir = join(import.meta.dirname, "../migrations");

const applySqlFile = async (db: PGlite, fileName: string) => {
  const statements = readFileSync(join(migrationsDir, fileName), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.exec(statement);
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
  it("upgrades a complete legacy schema without migration tracking", async () => {
    const db = new PGlite();
    await applySqlFile(db, "0000_init.sql");

    const result = await runMigrations(db, migrationsDir);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(1);
    const migrations = await db.query<{ name: string }>(
      `SELECT name FROM _ordine_migrations ORDER BY name`,
    );
    expect(migrations.rows.map(({ name }) => name)).toEqual([
      "0000_init.sql",
      "0001_add_ordine_domain_tables.sql",
    ]);
    const projects = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'projects'`,
    );
    expect(projects.rows).toHaveLength(1);

    await db.close();
  });
});
