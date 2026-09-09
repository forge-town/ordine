import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { createExecutionDatabase, type ExecutionDatabase } from "@repo/db/execution";
import {
  createExecutionMigrationRepository,
  type ExecutionMigrationRepository,
} from "@repo/models";
import { createExecutionMigrationService } from "../createExecutionMigrationService";
import { migrationBytesSha256 } from "../validateExecutionMigration";
import { migrationFixture } from "./fixtures";

const databaseUrl = process.env["R11_DATABASE_URL"];
describe.skipIf(!databaseUrl)("offline migration PostgreSQL atomic import", () => {
  const schema = `r11_${randomUUID().replaceAll("-", "")}`;
  const state: { database?: ExecutionDatabase; repository?: ExecutionMigrationRepository } = {};
  const evidence: Record<string, unknown> = {
    schema,
    database: "ordine_pipeline_v2_r5",
    port: 36_435,
  };

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "36435" ||
      url.pathname !== "/ordine_pipeline_v2_r5"
    )
      throw new Error("R11 integration requires the explicit isolated test database");
    const migrationPath = resolve("../../apps/create/migrations-v2/0001_execution.sql");
    const opened = await createExecutionDatabase({
      url: databaseUrl!,
      schema,
      initialize: true,
      migrationPath,
    });
    if (opened.isErr()) throw opened.error;
    state.database = opened.value;
    state.repository = createExecutionMigrationRepository({
      db: state.database.connection,
      schema,
      migrationSha256: migrationBytesSha256(await readFile(migrationPath)),
    });
  });
  afterAll(async () => {
    if (state.database) await state.database.close();
    const admin = postgres(databaseUrl!, { onnotice: () => {} });
    // Only the exact random schema created by this test is removed; never shared/public.
    if (!/^r11_[a-f0-9]{32}$/.test(schema)) throw new Error("Unexpected cleanup target");
    await admin`DROP SCHEMA IF EXISTS ${admin(schema)} CASCADE`;
    await admin.end();
    const directory = process.env["R11_REPORT_DIRECTORY"];
    if (directory)
      await writeFile(
        resolve(directory, `r11-offline-rebuild-db-${schema}.json`),
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
      );
  });

  const counts = async () => {
    const rows = await state.database!.connection.execute(sql`SELECT
      (SELECT count(*)::int FROM execution_operation_heads) AS heads,
      (SELECT count(*)::int FROM execution_operation_revisions) AS operations,
      (SELECT count(*)::int FROM execution_pipelines) AS pipelines,
      (SELECT count(*)::int FROM execution_jobs) AS jobs,
      (SELECT count(*)::int FROM execution_artifacts) AS artifacts,
      (SELECT count(*)::int FROM execution_runtime_configs) AS runtimes`);

    return rows[0];
  };

  it("rolls back heads/revisions when a later operation conflicts", async () => {
    const { bundle } = migrationFixture();
    await expect(
      state.repository!.importIntoEmptyWorkspace({
        workspaceId: bundle.targetWorkspaceId,
        confirmNewWorkspace: true,
        operations: [bundle.operations[0]!, bundle.operations[0]!],
        pipelines: bundle.pipelines,
      }),
    ).rejects.toMatchObject({ code: "write_conflict" });
    const after = await counts();
    expect(after).toEqual({
      heads: 0,
      operations: 0,
      pipelines: 0,
      jobs: 0,
      artifacts: 0,
      runtimes: 0,
    });
    evidence["atomicRollback"] = after;
  });
  it("rolls back the complete set after a Pipeline has already been written", async () => {
    const { bundle } = migrationFixture();
    await expect(
      state.repository!.importIntoEmptyWorkspace({
        workspaceId: bundle.targetWorkspaceId,
        confirmNewWorkspace: true,
        operations: bundle.operations,
        pipelines: [bundle.pipelines[0]!, bundle.pipelines[0]!],
      }),
    ).rejects.toMatchObject({ code: "write_conflict" });
    const after = await counts();
    expect(after).toEqual({
      heads: 0,
      operations: 0,
      pipelines: 0,
      jobs: 0,
      artifacts: 0,
      runtimes: 0,
    });
    evidence["rollbackAfterPipelineWrite"] = after;
  });
  it("commits exactly one concurrent import and refuses the other and later duplicates", async () => {
    const fixture = migrationFixture();
    const service = createExecutionMigrationService({ repository: state.repository! });
    const results = await Promise.all([
      service.importBundle(fixture.bundle, fixture.sourceBytes),
      service.importBundle(fixture.bundle, fixture.sourceBytes),
    ]);
    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(
      results
        .filter((result) => result.isErr())
        .map((result) => result.isErr() && result.error.code),
    ).toEqual(["target_not_empty"]);
    const after = await counts();
    expect(after).toEqual({
      heads: 1,
      operations: 1,
      pipelines: 1,
      jobs: 0,
      artifacts: 0,
      runtimes: 0,
    });
    const duplicate = await service.importBundle(fixture.bundle, fixture.sourceBytes);
    expect(duplicate.isErr() && duplicate.error.code).toBe("target_not_empty");
    expect(await counts()).toEqual(after);
    evidence["committedCounts"] = after;
    evidence["concurrentSuccessCount"] = 1;
    evidence["duplicateRejected"] = true;
    const success = results.find((result) => result.isOk());
    evidence["report"] = success?.isOk() ? success.value : undefined;
  });
});
