import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PipelineAssetSchema } from "@repo/schemas";

const rootDir = join(import.meta.dirname, "../../../../");
const migrationsDir = join(rootDir, "apps/create/migrations");

const applyMigrations = async (db: PGlite) => {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const statements = readFileSync(join(migrationsDir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.exec(statement);
    }
  }
};

const baseAsset = {
  id: "asset-1",
  pipeline_id: "pipeline-1",
  name: "Translation Asset",
  description: "",
  snapshot_nodes: [
    {
      id: "n1",
      type: "operation",
      position: { x: 0, y: 0 },
      data: {
        label: "Translate",
        nodeType: "operation",
        operationId: "translate",
        operationName: "Translate",
        status: "idle",
      },
    },
  ],
  snapshot_edges: [],
  input_slots: [],
  total_runs: 0,
  success_rate: null,
  avg_duration_ms: null,
  tags: ["translation"],
};

describe("pipeline_assets round-trip", () => {
  it("inserts, reads and parses a valid pipeline asset", async () => {
    const db = new PGlite();
    await applyMigrations(db);

    await db.exec(`
      INSERT INTO pipelines (id, name) VALUES ('pipeline-1', 'Test Pipeline');
    `);

    await db.query(
      `
      INSERT INTO pipeline_assets (
        id, pipeline_id, name, description, snapshot_nodes, snapshot_edges,
        input_slots, total_runs, success_rate, avg_duration_ms, tags
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11::jsonb
      )
    `,
      [
        baseAsset.id,
        baseAsset.pipeline_id,
        baseAsset.name,
        baseAsset.description,
        JSON.stringify(baseAsset.snapshot_nodes),
        JSON.stringify(baseAsset.snapshot_edges),
        JSON.stringify(baseAsset.input_slots),
        baseAsset.total_runs,
        baseAsset.success_rate,
        baseAsset.avg_duration_ms,
        JSON.stringify(baseAsset.tags),
      ],
    );

    const result = await db.query<{
      id: string;
      pipeline_id: string;
      name: string;
      description: string;
      snapshot_nodes: unknown;
      snapshot_edges: unknown;
      input_slots: unknown;
      total_runs: number;
      success_rate: string | null;
      avg_duration_ms: number | null;
      tags: unknown;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM pipeline_assets WHERE id = 'asset-1'`);

    const row = result.rows[0];
    expect(row).toBeDefined();

    const parsed = PipelineAssetSchema.parse({
      id: row.id,
      pipelineId: row.pipeline_id,
      name: row.name,
      description: row.description,
      snapshotNodes: row.snapshot_nodes,
      snapshotEdges: row.snapshot_edges,
      inputSlots: row.input_slots,
      totalRuns: row.total_runs,
      successRate: row.success_rate === null ? null : Number.parseFloat(row.success_rate),
      avgDurationMs: row.avg_duration_ms,
      tags: row.tags,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });

    expect(parsed.tags).toEqual(["translation"]);
    expect(parsed.snapshotNodes).toHaveLength(1);

    await db.close();
  });

  it("rejects a pipeline asset without tags at the schema level", () => {
    expect(() =>
      PipelineAssetSchema.parse({
        ...baseAsset,
        id: "asset-2",
        tags: [],
      }),
    ).toThrow();
  });

  it("rejects a pipeline asset without snapshot nodes at the schema level", () => {
    expect(() =>
      PipelineAssetSchema.parse({
        ...baseAsset,
        id: "asset-3",
        snapshot_nodes: [],
      }),
    ).toThrow();
  });
});
