import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { PipelineAssetSchema } from "@repo/schemas";

const rootDir = join(import.meta.dirname, "../../../../");
const migrationsDir = join(rootDir, "apps/create/migrations");
const testDatabaseUrl = new URL(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ordine",
);
testDatabaseUrl.pathname = "/ordine_db_schema_test";
const databaseUrl = process.env.ORDINE_DB_SCHEMA_TEST_DATABASE_URL ?? testDatabaseUrl.toString();

beforeEach(async () => {
  const db = postgres(databaseUrl, { onnotice: () => {} });
  await db.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await db.end();
});

const applyMigrations = async (db: ReturnType<typeof postgres>) => {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const statements = readFileSync(join(migrationsDir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.unsafe(statement);
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
    const db = postgres(databaseUrl, { onnotice: () => {} });
    await applyMigrations(db);

    await db.unsafe(`
      INSERT INTO pipelines (id, name) VALUES ('pipeline-1', 'Test Pipeline');
    `);

    await db.unsafe(
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
        baseAsset.snapshot_nodes,
        baseAsset.snapshot_edges,
        baseAsset.input_slots,
        baseAsset.total_runs,
        baseAsset.success_rate,
        baseAsset.avg_duration_ms,
        baseAsset.tags,
      ],
    );

    const result = await db.unsafe<
      {
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
      }[]
    >(`SELECT * FROM pipeline_assets WHERE id = 'asset-1'`);

    const row = result[0];
    expect(row).toBeDefined();
    if (!row) throw new Error("pipeline_assets row not found");

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

    await db.end();
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
