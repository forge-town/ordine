import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, it, onTestFinished } from "vitest";
import postgres from "postgres";
import { authoringSchemaFor, initializeAuthoringDatabase } from "@repo/db/execution";

const databaseUrl = process.env.ORDINE_PRODUCT_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("isolated authoring metadata", () => {
  it("initializes once, preserves public objects, serializes retries and detects damaged schema", async () => {
    const url = new URL(databaseUrl!);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("36435");
    expect(url.pathname).toMatch(/^\/ordine_product_ui_[a-z0-9_]+$/u);
    const client = postgres(databaseUrl!, { max: 1, onnotice: () => undefined });
    const schema = authoringSchemaFor(randomUUID());
    onTestFinished(async () => {
      await client`DROP SCHEMA IF EXISTS ${client(schema)} CASCADE`;
      await client.end();
    });
    const options = {
      url: databaseUrl!,
      schema,
      initialize: false,
      migrationsDirectory: fileURLToPath(
        new URL("../../../../apps/create/migrations", import.meta.url),
      ),
    };
    const before =
      await client`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename`;
    const absent = await initializeAuthoringDatabase(options);
    expect(absent.isErr()).toBe(true);
    const created = await initializeAuthoringDatabase({ ...options, initialize: true });
    expect(created.isOk(), JSON.stringify(created)).toBe(true);
    const leaseColumns =
      await client`SELECT column_name FROM information_schema.columns WHERE table_schema=${schema} AND table_name='jobs' AND column_name IN ('last_progress_at','heartbeat_at','lease_owner_id','lease_expires_at','expiry_context')`;
    expect(leaseColumns).toHaveLength(5);
    const repeated = await Promise.all([
      initializeAuthoringDatabase(options),
      initializeAuthoringDatabase({ ...options, initialize: true }),
    ]);
    expect(repeated.every((result) => result.isOk())).toBe(true);
    const after =
      await client`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename`;
    expect([...after]).toEqual([...before]);
    await client`ALTER TABLE ${client(schema)}.pipelines DROP COLUMN description`;
    expect((await initializeAuthoringDatabase(options)).isErr()).toBe(true);
    expect(schema).toMatch(/^ordine_authoring_[a-f0-9]{16}$/u);
  });
});
