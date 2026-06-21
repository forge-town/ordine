import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createAnnotationsDao } from "./annotationsDao";
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
  targetId: "node-1",
  targetType: "node" as const,
  author: "user" as const,
  content: "Looks good",
  resolved: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createAnnotationsDao(mockDb as unknown as DbExecutor);

describe("annotationsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAll returns ordered annotations", async () => {
    const row = makeRow("annotation-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("annotation-1");
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("getById returns annotation when found", async () => {
    const row = makeRow("annotation-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.getById("annotation-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("annotation-2");
  });

  it("getByPipelineId returns annotations for pipeline", async () => {
    const row = makeRow("annotation-3");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getByPipelineId("pipeline-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.pipelineId).toBe("pipeline-1");
    expect(mockWhere).toHaveBeenCalled();
  });

  it("getByTargetId returns annotations for target", async () => {
    const row = makeRow("annotation-4");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getByTargetId("node-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.targetId).toBe("node-1");
    expect(mockWhere).toHaveBeenCalled();
  });

  it("create inserts and returns annotation", async () => {
    const row = makeRow("annotation-5");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "annotation-5",
      pipelineId: "pipeline-1",
      targetId: "node-1",
      targetType: "node",
      author: "user",
      content: "Looks good",
    });

    expect(result.id).toBe("annotation-5");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("update patches and returns annotation", async () => {
    const row = { ...makeRow("annotation-6"), resolved: true };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("annotation-6", { resolved: true });

    expect(result?.resolved).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ resolved: true }));
  });

  it("delete removes annotation", async () => {
    await dao.delete("annotation-7");

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});
