import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createPipelineAssetsDao } from "./pipelineAssetsDao";
import type { DbExecutor } from "../../types";

const mockReturning = vi.fn();
const mockLimit = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockOrderBy = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockWhere = vi.fn(() => ({
  returning: mockReturning,
  limit: mockLimit,
  orderBy: mockOrderBy,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  orderBy: mockOrderBy,
}));
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockWhere }));

const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
  insert: vi.fn(() => ({ values: mockValues })),
  update: vi.fn(() => ({ set: mockSet })),
  delete: vi.fn(() => ({ where: mockWhere })),
};

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>();

  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
    desc: vi.fn((col) => ({ col, type: "desc" })),
  };
});

const makeRow = (id: string) => ({
  id,
  pipelineId: "pipeline-1",
  name: "Asset",
  description: "",
  snapshotNodes: [],
  snapshotEdges: [],
  inputSlots: [],
  totalRuns: 0,
  successRate: null,
  avgDurationMs: null,
  tags: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createPipelineAssetsDao(mockDb as unknown as DbExecutor);

describe("pipelineAssetsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAll returns ordered pipeline assets", async () => {
    const row = makeRow("asset-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("asset-1");
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("getById returns pipeline asset when found", async () => {
    const row = makeRow("asset-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.getById("asset-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("asset-2");
  });

  it("getByPipelineId returns assets for pipeline", async () => {
    const row = makeRow("asset-3");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getByPipelineId("pipeline-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.pipelineId).toBe("pipeline-1");
    expect(mockWhere).toHaveBeenCalled();
  });

  it("create inserts and returns pipeline asset", async () => {
    const row = makeRow("asset-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "asset-4",
      pipelineId: "pipeline-1",
      name: "Asset",
      snapshotNodes: [],
      snapshotEdges: [],
    });

    expect(result.id).toBe("asset-4");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("update patches and returns pipeline asset", async () => {
    const row = { ...makeRow("asset-5"), name: "Updated" };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("asset-5", { name: "Updated" });

    expect(result?.name).toBe("Updated");
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
  });

  it("incrementRunStats updates counters with one statement", async () => {
    const row = {
      ...makeRow("asset-6"),
      totalRuns: 1,
      successRate: "1.0000",
      avgDurationMs: 1200,
    };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.incrementRunStats("asset-6", { success: true, durationMs: 1200 });
    const setPayload = (mockSet.mock.calls as Array<Array<Record<string, unknown>>>)[0]?.[0];

    expect(result?.id).toBe("asset-6");
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(setPayload).toEqual(
      expect.objectContaining({
        totalRuns: expect.any(Object),
        successRate: expect.any(Object),
        avgDurationMs: expect.any(Object),
        updatedAt: expect.any(Date),
      }),
    );
  });

  it("delete removes pipeline asset", async () => {
    await dao.delete("asset-7");

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});
