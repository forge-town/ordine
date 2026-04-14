import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";

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

vi.mock("@repo/db", () => ({
  db: {
    select: vi.fn(() => ({ from: mockFrom })),
    insert: vi.fn(() => ({ values: mockValues })),
    update: vi.fn(() => ({ set: mockSet })),
    delete: vi.fn(() => ({ where: mockWhere })),
  },
}));

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

describe("checklistItemsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByBestPracticeId returns entities with numeric timestamps", async () => {
    const row = makeRow("ci-1", "bp-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const { checklistItemsDao } = await import("@repo/models");
    const result = await checklistItemsDao.findByBestPracticeId("bp-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ci-1");
    expect(typeof result[0].createdAt).toBe("number");
    expect(typeof result[0].updatedAt).toBe("number");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("ci-2");
    mockLimit.mockResolvedValueOnce([row]);

    const { checklistItemsDao } = await import("@repo/models");
    const result = await checklistItemsDao.findById("ci-2");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("ci-2");
    expect(result?.checkType).toBe("llm");
  });

  it("findById returns null when not found", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const { checklistItemsDao } = await import("@repo/models");
    const result = await checklistItemsDao.findById("nonexistent");

    expect(result).toBeNull();
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("ci-3");
    mockReturning.mockResolvedValueOnce([row]);

    const { checklistItemsDao } = await import("@repo/models");
    const result = await checklistItemsDao.create({
      id: "ci-3",
      bestPracticeId: "bp-1",
      title: "Check naming",
      description: "Ensure naming conventions",
      checkType: "llm",
      script: null,
      sortOrder: 0,
    });

    expect(result.id).toBe("ci-3");
    expect(typeof result.createdAt).toBe("number");
  });

  it("update returns entity on success", async () => {
    const row = makeRow("ci-4");
    mockReturning.mockResolvedValueOnce([row]);

    const { checklistItemsDao } = await import("@repo/models");
    const result = await checklistItemsDao.update("ci-4", {
      title: "Updated title",
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("ci-4");
  });

  it("update returns null when not found", async () => {
    mockReturning.mockResolvedValueOnce([]);

    const { checklistItemsDao } = await import("@repo/models");
    const result = await checklistItemsDao.update("nonexistent", {
      title: "x",
    });

    expect(result).toBeNull();
  });

  it("delete calls db.delete with correct id", async () => {
    const { checklistItemsDao } = await import("@repo/models");
    await checklistItemsDao.delete("ci-5");

    expect(mockWhere).toHaveBeenCalled();
  });

  it("script field is preserved for script-type items", async () => {
    const row = {
      ...makeRow("ci-6"),
      checkType: "script" as const,
      script: "return files.every(f => f.endsWith('.ts'))",
    };
    mockReturning.mockResolvedValueOnce([row]);

    const { checklistItemsDao } = await import("@repo/models");
    const result = await checklistItemsDao.create({
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
