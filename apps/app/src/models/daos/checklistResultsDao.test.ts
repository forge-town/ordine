import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";

// ─── Mock DB ─────────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockSelectWhere = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockWriteWhere = vi.fn(() => ({
  returning: mockReturning,
}));
const mockDeleteWhere = vi.fn(() => Promise.resolve());
const mockFrom = vi.fn(() => ({
  where: mockSelectWhere,
}));
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockWriteWhere }));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: mockFrom })),
    insert: vi.fn(() => ({ values: mockValues })),
    update: vi.fn(() => ({ set: mockSet })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRow = (id: string, jobId = "job-1") => ({
  id,
  jobId,
  checklistItemId: "ci-1",
  passed: true,
  output: "All checks passed",
  createdAt: new Date("2024-01-01"),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("checklistResultsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByJobId returns entities with numeric timestamps", async () => {
    const row = makeRow("cr-1", "job-1");
    mockSelectWhere.mockResolvedValueOnce([row]);

    const { checklistResultsDao } = await import("./checklistResultsDao");
    const result = await checklistResultsDao.findByJobId("job-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cr-1");
    expect(typeof result[0].createdAt).toBe("number");
    expect(result[0].passed).toBe(true);
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("cr-2");
    mockReturning.mockResolvedValueOnce([row]);

    const { checklistResultsDao } = await import("./checklistResultsDao");
    const result = await checklistResultsDao.create({
      id: "cr-2",
      jobId: "job-1",
      checklistItemId: "ci-1",
      passed: true,
      output: "All checks passed",
    });

    expect(result.id).toBe("cr-2");
    expect(typeof result.createdAt).toBe("number");
  });

  it("update returns entity on success", async () => {
    const row = {
      ...makeRow("cr-3"),
      passed: false,
      output: "Failed: naming mismatch",
    };
    mockReturning.mockResolvedValueOnce([row]);

    const { checklistResultsDao } = await import("./checklistResultsDao");
    const result = await checklistResultsDao.update("cr-3", {
      passed: false,
      output: "Failed: naming mismatch",
    });

    expect(result).not.toBeNull();
    expect(result?.passed).toBe(false);
    expect(result?.output).toBe("Failed: naming mismatch");
  });

  it("update returns null when not found", async () => {
    mockReturning.mockResolvedValueOnce([]);

    const { checklistResultsDao } = await import("./checklistResultsDao");
    const result = await checklistResultsDao.update("nonexistent", {
      passed: true,
    });

    expect(result).toBeNull();
  });

  it("deleteByJobId calls db.delete", async () => {
    const { checklistResultsDao } = await import("./checklistResultsDao");
    await checklistResultsDao.deleteByJobId("job-1");

    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});
