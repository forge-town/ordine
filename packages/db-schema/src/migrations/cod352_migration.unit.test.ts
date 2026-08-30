import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = join(import.meta.dirname, "../../../..");
const createMigration = join(rootDir, "apps/create/migrations/0013_job_execution_leases.sql");
const appMigration = join(rootDir, "apps/app/drizzle/0039_job_execution_leases.sql");
const appJournal = join(rootDir, "apps/app/drizzle/meta/_journal.json");

describe("COD-352 migration", () => {
  it("keeps both migration tracks identical and journaled", () => {
    expect(existsSync(createMigration), "create migration must exist").toBe(true);
    expect(existsSync(appMigration), "app migration must exist").toBe(true);
    expect(readFileSync(createMigration, "utf8")).toBe(readFileSync(appMigration, "utf8"));

    const journal = JSON.parse(readFileSync(appJournal, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(journal.entries.find((entry) => entry.idx === 39)).toMatchObject({
      idx: 39,
      tag: "0039_job_execution_leases",
    });
  });

  it("backfills progress before enforcing the lease columns and indexes", () => {
    const sql = readFileSync(createMigration, "utf8");
    const backfillAt = sql.indexOf('UPDATE "jobs"');
    const notNullAt = sql.indexOf('ALTER COLUMN "last_progress_at" SET NOT NULL');

    expect(backfillAt).toBeGreaterThan(-1);
    expect(notNullAt).toBeGreaterThan(backfillAt);
    expect(sql).toContain('ADD COLUMN "heartbeat_at" timestamp');
    expect(sql).toContain('ADD COLUMN "lease_owner_id" text');
    expect(sql).toContain('ADD COLUMN "lease_expires_at" timestamp');
    expect(sql).toContain('ADD COLUMN "expiry_context" jsonb');
    expect(sql).toContain('CREATE INDEX "jobs_status_created_at_idx"');
    expect(sql).toContain('CREATE INDEX "jobs_status_last_progress_at_idx"');
    expect(sql).toContain('CREATE INDEX "jobs_status_lease_expires_at_idx"');
  });
});
