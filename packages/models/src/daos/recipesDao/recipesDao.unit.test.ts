import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createRecipesDao } from "./recipesDao";
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

const makeRow = (id: string, operationId = "op-1") => ({
  id,
  operationId,
  bestPracticeId: "bp-1",
  name: "Recipe",
  description: "Desc",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createRecipesDao(mockDb as unknown as DbExecutor);

describe("recipesDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns ordered entities", async () => {
    const row = makeRow("r-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("r-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("r-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("r-2");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("r-2");
  });

  it("findByOperationId returns ordered entities", async () => {
    const row = makeRow("r-3");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findByOperationId("op-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("r-3");
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("r-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "r-4",
      operationId: "op-1",
      bestPracticeId: "bp-1",
      name: "Recipe",
      description: "Desc",
    });

    expect(result.id).toBe("r-4");
  });

  it("update returns entity on success", async () => {
    const row = makeRow("r-5");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("r-5", { name: "Updated" });

    expect(result).not.toBeNull();
  });

  it("delete calls db.delete", async () => {
    await dao.delete("r-6");
    expect(mockWhere).toHaveBeenCalled();
  });
});
