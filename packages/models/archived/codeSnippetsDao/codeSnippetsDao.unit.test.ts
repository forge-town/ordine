import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createCodeSnippetsDao } from "./codeSnippetsDao";
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
    asc: vi.fn((col) => ({ col, type: "asc" })),
  };
});

const makeRow = (id: string, bestPracticeId = "bp-1") => ({
  id,
  bestPracticeId,
  title: "Snippet",
  code: "const x = 1;",
  language: "typescript",
  sortOrder: 0,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createCodeSnippetsDao(mockDb as unknown as DbExecutor);

describe("codeSnippetsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByBestPracticeId returns ordered entities", async () => {
    const row = makeRow("cs-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findByBestPracticeId("bp-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("cs-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("cs-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("cs-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("cs-2");
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("cs-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "cs-3",
      bestPracticeId: "bp-1",
      title: "Snippet",
      code: "const x = 1;",
      language: "typescript",
      sortOrder: 0,
    });

    expect(result.id).toBe("cs-3");
  });

  it("update returns entity on success", async () => {
    const row = makeRow("cs-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("cs-4", { title: "Updated" });

    expect(result).not.toBeUndefined();
  });

  it("deleteByBestPracticeId calls db.delete", async () => {
    await dao.deleteByBestPracticeId("bp-1");
    expect(mockWhere).toHaveBeenCalled();
  });
});
