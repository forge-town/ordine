import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createBestPracticesDao } from "./bestPracticesDao";
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
  title: "Best Practice",
  condition: "Description",
  content: "Content",
  category: "general",
  language: "typescript",
  codeSnippet: "",
  tags: [] as string[],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createBestPracticesDao(mockDb as unknown as DbExecutor);

describe("bestPracticesDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns ordered entities", async () => {
    const row = makeRow("bp-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("bp-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("bp-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("bp-2");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("bp-2");
  });

  it("findById returns null when not found", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const result = await dao.findById("nonexistent");

    expect(result).toBeNull();
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("bp-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "bp-3",
      title: "Best Practice",
      condition: "Description",
      content: "Content",
    });

    expect(result.id).toBe("bp-3");
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("update returns entity on success", async () => {
    const row = makeRow("bp-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("bp-4", { title: "Updated" });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("bp-4");
  });

  it("delete calls db.delete", async () => {
    await dao.delete("bp-5");
    expect(mockWhere).toHaveBeenCalled();
  });
});
