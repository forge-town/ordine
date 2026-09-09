// Non-destructive rehearsal: dump one test-owned schema and restore into a newly created database.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ResultAsync } from "neverthrow";
import postgres from "postgres";
import { createExecutionDatabase } from "./index.ts";

const sourceUrl = process.env.EXECUTION_BOOTSTRAP_TEST_URL;
assert.equal(sourceUrl, "postgres://postgres@127.0.0.1:36435/ordine_pipeline_v2_r5");
const evidencePath = process.env.EXECUTION_BOOTSTRAP_EVIDENCE;
assert.ok(evidencePath);
const previous = JSON.parse(await readFile(evidencePath, "utf8"));
assert.match(previous.prefix, /^r11_\d+_[a-f0-9]{6}$/);
assert.equal(previous.passed, 13);
const schema = `${previous.prefix}_fresh`;
const target = `ordine_r11_restore_${Date.now()}_${randomBytes(3).toString("hex")}`;
const container = "ordine-pipeline-v2-r5-20260905";
const backupPath = `/tmp/${target}.dump`;
const localBackup = join(process.env.EXECUTION_BOOTSTRAP_OUTPUT, `${target}.dump`);
const source = postgres(sourceUrl, { max: 1, onnotice: () => {} });
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 30_000, windowsHide: true }).trim();
const handles = [];

const rehearsal = await ResultAsync.fromPromise(
  (async () => {
    await source`INSERT INTO ${source(schema)}.execution_workspace_settings
    (workspace_id,execution_defaults,revision) VALUES (${target},${source.json({ rehearsal: target })},1)`;
    docker(
      "exec",
      container,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "ordine_pipeline_v2_r5",
      "--schema",
      schema,
      "-Fc",
      "-f",
      backupPath,
    );
    docker("cp", `${container}:${backupPath}`, localBackup);
    const digest = createHash("sha256")
      .update(await readFile(localBackup))
      .digest("hex");
    docker("exec", container, "createdb", "-U", "postgres", target);
    docker(
      "exec",
      container,
      "pg_restore",
      "-U",
      "postgres",
      "--exit-on-error",
      "-d",
      target,
      backupPath,
    );
    const restored = await createExecutionDatabase({
      url: `postgres://postgres@127.0.0.1:36435/${target}`,
      schema,
      initialize: false,
    });
    assert.equal(restored.isOk(), true, restored.isErr() ? restored.error.code : "");
    handles.push(restored.value);
    assert.deepEqual(await restored.value.probe(), { reachable: true, schemaVersion: 2 });
    const restoredSql = postgres(`postgres://postgres@127.0.0.1:36435/${target}`, { max: 1 });
    handles.push({ close: () => restoredSql.end() });
    const rows = await restoredSql`SELECT workspace_id,execution_defaults,revision
    FROM ${restoredSql(schema)}.execution_workspace_settings WHERE workspace_id=${target}`;
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      workspace_id: target,
      execution_defaults: { rehearsal: target },
      revision: 1,
    });
    const evidence = {
      timestamp: new Date().toISOString(),
      sourceDatabase: "ordine_pipeline_v2_r5",
      sourceSchema: schema,
      targetDatabase: target,
      targetSchema: schema,
      backupPath: localBackup,
      backupSha256: digest,
      pgDumpExit: 0,
      pgRestoreExit: 0,
      restoredBootstrap: "initialize=false accepted original SHA and structural fingerprint",
      restoredProbe: { reachable: true, schemaVersion: 2 },
      sampleRowMatches: true,
      dataDeletion: false,
    };
    await writeFile(
      join(process.env.EXECUTION_BOOTSTRAP_OUTPUT, "r11-bootstrap.restore.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
    console.log(JSON.stringify(evidence, null, 2));
  })(),
  (error) => error,
);
await Promise.all(handles.map((handle) => handle.close()));
await source.end();
if (rehearsal.isErr()) throw rehearsal.error;
