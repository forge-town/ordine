// Run with Bun. Creates only random self-owned schemas; leaves them for inspection.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { sql as drizzleSql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

const url = process.env.EXECUTION_BOOTSTRAP_TEST_URL;
assert.equal(
  url,
  "postgres://postgres@127.0.0.1:36435/ordine_pipeline_v2_r5",
  "explicit isolated test URL required",
);
// Importing this subpath must not read the legacy DATABASE_URL or construct its singleton.
process.env.DATABASE_URL = "not-a-database-url";
const { createExecutionDatabase, ExecutionDatabaseError } = await import("./index.ts");
const admin = postgres(url, { max: 2, onnotice: () => {} });
const prefix = `r11_${Date.now()}_${randomBytes(3).toString("hex")}`;
const evidence = { prefix, url, startedAt: new Date().toISOString(), cases: [] };
const handles = [];
const schema = (suffix) => `${prefix}_${suffix}`;
const open = (target, initialize = true, migrationPath) =>
  createExecutionDatabase({
    url,
    schema: target,
    initialize,
    ...(migrationPath ? { migrationPath } : {}),
  });
const good = (result) => {
  assert.equal(
    result.isOk(),
    true,
    result.isErr() ? `${result.error.code}: ${result.error.message}` : "",
  );
  handles.push(result.value);

  return result.value;
};
const rejected = (result, code) => {
  assert.equal(result.isErr(), true);
  assert.ok(result.error instanceof ExecutionDatabaseError);
  assert.equal(result.error.code, code);
  assert.ok(!JSON.stringify(result.error).includes(url));
};
const record = (name) => evidence.cases.push({ name, passed: true });

const verified = await ResultAsync.fromPromise(
  (async () => {
    const fresh = good(await open(schema("fresh")));
    assert.deepEqual(await fresh.probe(), { reachable: true, schemaVersion: 2 });
    const scope = await fresh.connection.execute(drizzleSql`SELECT current_schema() AS schema`);
    assert.equal(scope[0].schema, schema("fresh"));
    const tableCount =
      await admin`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema=${schema("fresh")}`;
    assert.equal(tableCount[0].count, 15);
    record("fresh initialization: complete 14 tables + marker, runtime connection schema, probe");

    const repeat = good(await open(schema("fresh"), false));
    assert.deepEqual(await repeat.probe(), { reachable: true, schemaVersion: 2 });
    good(await open(schema("fresh"), true));
    record("same SHA/version repeated initialization and initialize=false are idempotent");

    const competitors = await Promise.all([open(schema("race")), open(schema("race"))]);
    for (const result of competitors) {
      const probe = await good(result).probe();
      assert.equal(probe.schemaVersion, 2);
    }
    const markers =
      await admin`SELECT count(*)::int AS count FROM ${admin(schema("race"))}.execution_schema_meta`;
    assert.equal(markers[0].count, 1);
    record("two concurrent first starts serialize and produce one marker");

    rejected(await open(schema("missing"), false), "schema_not_initialized");
    const missing = await admin`SELECT 1 FROM pg_namespace WHERE nspname=${schema("missing")}`;
    assert.equal(missing.length, 0);
    record("initialize=false does not create absent schema");

    await admin`CREATE SCHEMA ${admin(schema("legacy"))}`;
    await admin`CREATE TABLE ${admin(schema("legacy"))}.users (id integer PRIMARY KEY)`;
    await admin`INSERT INTO ${admin(schema("legacy"))}.users VALUES (42)`;
    rejected(await open(schema("legacy")), "schema_conflict");
    const preserved = await admin`SELECT id FROM ${admin(schema("legacy"))}.users`;
    assert.equal(preserved[0].id, 42);
    record("legacy schema refused; original row preserved");

    await admin`CREATE SCHEMA ${admin(schema("sequence"))}`;
    await admin`CREATE SEQUENCE ${admin(schema("sequence"))}.existing_sequence`;
    rejected(await open(schema("sequence")), "schema_conflict");
    record("schema with an existing non-table object is not considered empty");

    const scratch = await mkdtemp(join(tmpdir(), "ordine-r11-bootstrap-"));
    evidence.migrationScratch = scratch;
    const migration = await readFile(
      new URL("../../../../apps/create/migrations-v2/0001_execution.sql", import.meta.url),
      "utf8",
    );
    const changedPath = join(scratch, "changed.sql");
    await writeFile(changedPath, `${migration}\n-- changed migration checksum\n`, "utf8");
    rejected(await open(schema("fresh"), true, changedPath), "migration_mismatch");
    record("changed migration SHA refused");

    const failurePath = join(scratch, "failure.sql");
    await writeFile(
      failurePath,
      `${migration}\n--> statement-breakpoint\nCREATE INDEX "r11_failure" ON "execution_jobs" ("nonexistent_column");`,
      "utf8",
    );
    await admin`CREATE SCHEMA ${admin(schema("rollback"))}`;
    rejected(await open(schema("rollback"), true, failurePath), "initialization_failed");
    const leftovers =
      await admin`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${schema("rollback")}`;
    assert.equal(leftovers.length, 0);
    record(
      "failure after full migration rolls back all tables, constraints, indexes, and sequence",
    );

    good(await open(schema("mixed")));
    await admin`CREATE TABLE ${admin(schema("mixed"))}.legacy_users (id integer)`;
    rejected(await open(schema("mixed")), "schema_conflict");
    record("v2 marker plus unexpected legacy table refused");

    const damaged = good(await open(schema("damaged")));
    await admin`ALTER TABLE ${admin(schema("damaged"))}.execution_jobs DROP CONSTRAINT execution_jobs_budget_check`;
    rejected(await open(schema("damaged")), "schema_conflict");
    assert.deepEqual(await damaged.probe(), { reachable: true, schemaVersion: null });
    record("DDL damage rejected and probe does not advertise schema version 2");

    good(await open(schema("marker")));
    await admin`UPDATE ${admin(schema("marker"))}.execution_schema_meta SET schema_version=1`;
    rejected(await open(schema("marker")), "migration_mismatch");
    record("incorrect marker version refused");

    rejected(
      await createExecutionDatabase({
        url,
        schema: 'public";DROP SCHEMA public',
        initialize: true,
      }),
      "invalid_configuration",
    );
    rejected(
      await createExecutionDatabase({ url: "bad-url", initialize: true }),
      "invalid_configuration",
    );
    record("invalid identifiers and malformed URL fail safely before connection");

    await fresh.close();
    assert.deepEqual(await fresh.probe(), { reachable: false, schemaVersion: null });
    record("closed database connection probe reports unreachable");

    evidence.finishedAt = new Date().toISOString();
    evidence.passed = evidence.cases.length;
    if (process.env.EXECUTION_BOOTSTRAP_EVIDENCE) {
      await writeFile(
        process.env.EXECUTION_BOOTSTRAP_EVIDENCE,
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
      );
    }
    console.log(JSON.stringify(evidence, null, 2));
  })(),
  (error) => error,
);
await Promise.all(handles.map((handle) => handle.close()));
await admin.end();
if (verified.isErr()) throw verified.error;
