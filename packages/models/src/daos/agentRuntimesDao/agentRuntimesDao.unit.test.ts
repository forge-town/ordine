import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createAgentRuntimesDao } from "./agentRuntimesDao";
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
  name: "Test Runtime",
  type: "claude-code" as const,
  connection: { mode: "local" as const },
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createAgentRuntimesDao(mockDb as unknown as DbExecutor);

describe("agentRuntimesDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns ordered runtimes", async () => {
    const row = makeRow("rt-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("rt-1");
  });

  it("findById returns runtime when found", async () => {
    const row = makeRow("rt-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("rt-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("rt-2");
  });

  it("findById returns undefined when not found", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const result = await dao.findById("not-found");

    expect(result).toBeUndefined();
  });

  it("create inserts and returns runtime", async () => {
    const row = makeRow("rt-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "rt-3",
      name: "Test Runtime",
      type: "claude-code",
      connection: { mode: "local" },
    });

    expect(result.id).toBe("rt-3");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("update patches and returns runtime", async () => {
    const row = { ...makeRow("rt-4"), name: "Updated" };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("rt-4", { name: "Updated" });

    expect(result?.name).toBe("Updated");
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
  });

  it("delete removes runtime", async () => {
    await dao.delete("rt-5");

    expect(mockDb.delete).toHaveBeenCalled();
  });
});
