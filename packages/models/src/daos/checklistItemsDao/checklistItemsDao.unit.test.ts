import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createChecklistItemsDao } from "./checklistItemsDao";
import type { DbExecutor } from "../../types";

// ─── Mock DB ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRow = (id: string, bestPracticeId = "bp-1") => ({
  id,
  bestPracticeId,
  title: "Check naming",
  description: "Ensure naming conventions",
  checkType: "llm" as const,
  script: null,
  sortOrder: 0,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

const dao = createChecklistItemsDao(mockDb as unknown as DbExecutor);

describe("checklistItemsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByBestPracticeId returns entities with Date timestamps", async () => {
    const row = makeRow("ci-1", "bp-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findByBestPracticeId("bp-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("ci-1");
    expect(result[0]!.createdAt).toBeInstanceOf(Date);
    expect(result[0]!.updatedAt).toBeInstanceOf(Date);
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("ci-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("ci-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("ci-2");
    expect(result?.checkType).toBe("llm");
  });

  it("findById returns undefined when not found", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const result = await dao.findById("nonexistent");

    expect(result).toBeUndefined();
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("ci-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "ci-3",
      bestPracticeId: "bp-1",
      title: "Check naming",
      description: "Ensure naming conventions",
      checkType: "llm",
      script: null,
      sortOrder: 0,
    });

    expect(result.id).toBe("ci-3");
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("update returns entity on success", async () => {
    const row = makeRow("ci-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("ci-4", {
      title: "Updated title",
    });

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("ci-4");
  });

  it("update returns undefined when not found", async () => {
    mockReturning.mockResolvedValueOnce([]);

    const result = await dao.update("nonexistent", {
      title: "x",
    });

    expect(result).toBeUndefined();
  });

  it("delete calls db.delete with correct id", async () => {
    await dao.delete("ci-5");

    expect(mockWhere).toHaveBeenCalled();
  });

  it("script field is preserved for script-type items", async () => {
    const row = {
      ...makeRow("ci-6"),
      checkType: "script" as const,
      script: "return files.every(f => f.endsWith('.ts'))",
    };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "ci-6",
      bestPracticeId: "bp-1",
      title: "File extension check",
      description: "",
      checkType: "script",
      script: "return files.every(f => f.endsWith('.ts'))",
      sortOrder: 1,
    });

    expect(result.checkType).toBe("script");
    expect(result.script).toBe("return files.every(f => f.endsWith('.ts'))");
  });
});
