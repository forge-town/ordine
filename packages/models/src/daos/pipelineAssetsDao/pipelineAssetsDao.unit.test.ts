import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbExecutor } from "../../types";
import { createPipelineAssetsDao } from "./pipelineAssetsDao";

const asset = {
  id: "asset-1",
  pipelineId: "pipeline-1",
  name: "Reusable segment",
  description: "",
  snapshotNodes: [],
  snapshotEdges: [],
  inputSlots: [],
  totalRuns: 0,
  successRate: null,
  avgDurationMs: null,
  tags: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const returning = vi.fn(() => Promise.resolve([asset]));
const limit = vi.fn(() => Promise.resolve([asset]));
const orderBy = vi.fn(() => Promise.resolve([asset]));
const where = vi.fn(() => ({ limit, orderBy, returning }));
const from = vi.fn(() => ({ orderBy, where }));
const values = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));
const executor = {
  select: vi.fn(() => ({ from })),
  insert: vi.fn(() => ({ values })),
  update: vi.fn(() => ({ set })),
  delete: vi.fn(() => ({ where })),
} as unknown as DbExecutor;
const dao = createPipelineAssetsDao(executor);

describe("PipelineAssetsDao", () => {
  beforeEach(() => vi.clearAllMocks());

  it("implements CRUD, pipeline reads, and atomic run-stat updates", async () => {
    await expect(dao.findMany()).resolves.toEqual([asset]);
    await expect(dao.findById(asset.id)).resolves.toEqual(asset);
    await expect(dao.findManyByPipelineId(asset.pipelineId)).resolves.toEqual([asset]);
    await expect(
      dao.create({
        id: asset.id,
        pipelineId: asset.pipelineId,
        name: asset.name,
        snapshotNodes: [],
        snapshotEdges: [],
        tags: [],
      }),
    ).resolves.toEqual(asset);
    await expect(dao.update(asset.id, { name: "Updated" })).resolves.toEqual(asset);
    await expect(
      dao.incrementRunStats(asset.id, { success: true, durationMs: 1200 }),
    ).resolves.toEqual(asset);
    await expect(dao.delete(asset.id)).resolves.toBeUndefined();

    expect(limit).toHaveBeenCalledWith(1);
    expect(set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        totalRuns: expect.any(Object),
        successRate: expect.any(Object),
        avgDurationMs: expect.any(Object),
      }),
    );
  });
});
