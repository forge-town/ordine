import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

const migrationsFolder = join(import.meta.dirname, "../../../../apps/app/drizzle");
const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"));
const testDatabaseUrl = new URL(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ordine",
);
testDatabaseUrl.pathname = "/ordine_db_schema_test";
const databaseUrl = process.env.ORDINE_DB_SCHEMA_TEST_DATABASE_URL ?? testDatabaseUrl.toString();
const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
const temporary = { historicalFolder: "" };

beforeEach(async () => {
  await client.unsafe(
    "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public",
  );
});

afterEach(async () => {
  if (temporary.historicalFolder)
    rmSync(temporary.historicalFolder, { recursive: true, force: true });
  temporary.historicalFolder = "";
});

afterAll(async () => {
  await client.end();
});

const assertLeaseSchema = async () => {
  const columns = await client<
    { column_name: string; is_nullable: string; data_type: string; column_default: string | null }[]
  >`
    SELECT column_name, is_nullable, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs'
  `;
  expect(columns).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        column_name: "last_progress_at",
        is_nullable: "NO",
        column_default: "now()",
      }),
      expect.objectContaining({
        column_name: "heartbeat_at",
        is_nullable: "YES",
        data_type: "timestamp without time zone",
      }),
      expect.objectContaining({
        column_name: "lease_owner_id",
        is_nullable: "YES",
        data_type: "text",
      }),
      expect.objectContaining({
        column_name: "lease_expires_at",
        is_nullable: "YES",
        data_type: "timestamp without time zone",
      }),
      expect.objectContaining({
        column_name: "expiry_context",
        is_nullable: "YES",
        data_type: "jsonb",
      }),
    ]),
  );
  const indexes = await client<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'jobs'
  `;
  for (const column of ["created_at", "last_progress_at", "lease_expires_at"]) {
    expect(
      indexes.find((index) => index.indexname === `jobs_status_${column}_idx`)?.indexdef,
    ).toContain(`USING btree (status, ${column})`);
  }
  const applied = await client<{ created_at: string }[]>`
    SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY id
  `;
  expect(applied.map((row) => Number(row.created_at))).toEqual(
    journal.entries.map((entry: { when: number }) => entry.when),
  );
};

describe("COD-352 Web Drizzle migrations on PostgreSQL", () => {
  it("discovers and applies the complete journal from an empty database and can run again", async () => {
    await migrate(drizzle(client), { migrationsFolder });
    await assertLeaseSchema();
    await client`INSERT INTO jobs (id, title, type) VALUES ('new-job', 'New job', 'pipeline')`;
    const [job] =
      await client`SELECT last_progress_at, heartbeat_at, lease_owner_id, lease_expires_at, expiry_context FROM jobs WHERE id = 'new-job'`;
    expect(job?.last_progress_at).toBeTruthy();
    expect(job).toMatchObject({
      heartbeat_at: null,
      lease_owner_id: null,
      lease_expires_at: null,
      expiry_context: null,
    });
    await expect(
      client`UPDATE jobs SET last_progress_at = NULL WHERE id = 'new-job'`,
    ).rejects.toMatchObject({ code: "23502" });
    await migrate(drizzle(client), { migrationsFolder });
    await assertLeaseSchema();
  });

  it.each([13, 23, 38])(
    "upgrades historical journal baseline %i and preserves existing data",
    async (baseline) => {
      temporary.historicalFolder = mkdtempSync(join(tmpdir(), "ordine-web-migrations-"));
      mkdirSync(join(temporary.historicalFolder, "meta"));
      const entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= baseline);
      writeFileSync(
        join(temporary.historicalFolder, "meta/_journal.json"),
        JSON.stringify({ ...journal, entries }),
        "utf8",
      );
      for (const entry of entries) {
        copyFileSync(
          join(migrationsFolder, `${entry.tag}.sql`),
          join(temporary.historicalFolder, `${entry.tag}.sql`),
        );
      }
      await migrate(drizzle(client), { migrationsFolder: temporary.historicalFolder });
      await client`INSERT INTO operations (id, name, config) VALUES ('legacy-operation', 'Legacy operation', '{"prompt":"preserve me"}')`;
      if (baseline === 13) {
        await client`INSERT INTO settings (llm_provider, llm_model) VALUES ('codex', 'existing-model')`;
      } else {
        await client`INSERT INTO settings (default_agent_runtime, default_model) VALUES ('codex', 'existing-model')`;
      }
      if (baseline === 23) {
        await client`INSERT INTO agent_definitions (id, name, system_prompt) VALUES ('legacy-agent', 'Legacy agent', 'Keep this prompt')`;
      }
      await client`
      INSERT INTO jobs (id, title, type, status, created_at, started_at, updated_at, error)
      VALUES ('historical-job', 'Historical job', 'pipeline', 'failed',
              '2026-08-01 01:00:00', '2026-08-01 02:00:00', '2026-08-01 03:00:00', 'provider error')
    `;
      const [before] = await client`SELECT * FROM jobs WHERE id = 'historical-job'`;
      expect(before).not.toHaveProperty("last_progress_at");
      await migrate(drizzle(client), { migrationsFolder });
      await assertLeaseSchema();
      const [after] = await client`SELECT * FROM jobs WHERE id = 'historical-job'`;
      expect(after).toMatchObject({
        id: before!.id,
        title: before!.title,
        status: before!.status,
        error: before!.error,
        last_progress_at: before!.updated_at,
        heartbeat_at: null,
        lease_owner_id: null,
        lease_expires_at: null,
        expiry_context: null,
      });
      expect(await client`SELECT config FROM operations WHERE id = 'legacy-operation'`).toEqual([
        { config: { prompt: "preserve me" } },
      ]);
      expect(await client`SELECT default_agent_runtime, default_model FROM settings`).toEqual([
        { default_agent_runtime: "codex", default_model: "existing-model" },
      ]);
      if (baseline === 23) {
        expect(await client`SELECT system_prompt FROM agents WHERE id = 'legacy-agent'`).toEqual([
          { system_prompt: "Keep this prompt" },
        ]);
      }
      await migrate(drizzle(client), { migrationsFolder });
      await assertLeaseSchema();
      expect(await client`SELECT * FROM jobs WHERE id = 'historical-job'`).toEqual([after]);
    },
  );
});
