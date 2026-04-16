import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createChecklistResultsDao } from "./checklistResultsDao";
import type { DbExecutor } from "../types";

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

const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
  insert: vi.fn(() => ({ values: mockValues })),
  update: vi.fn(() => ({ set: mockSet })),
  delete: vi.fn(() => ({ where: mockDeleteWhere })),
};

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

const dao = createChecklistResultsDao(mockDb as unknown as DbExecutor);

describe("checklistResultsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findByJobId returns entities with Date timestamps", async () => {
    const row = makeRow("cr-1", "job-1");
    mockSelectWhere.mockResolvedValueOnce([row]);

    const result = await dao.findByJobId("job-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cr-1");
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(result[0].passed).toBe(true);
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("cr-2");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "cr-2",
      jobId: "job-1",
      checklistItemId: "ci-1",
      passed: true,
      output: "All checks passed",
    });

    expect(result.id).toBe("cr-2");
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("update returns entity on success", async () => {
    const row = {
      ...makeRow("cr-3"),
      passed: false,
      output: "Failed: naming mismatch",
    };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("cr-3", {
      passed: false,
      output: "Failed: naming mismatch",
    });

    expect(result).not.toBeNull();
    expect(result?.passed).toBe(false);
    expect(result?.output).toBe("Failed: naming mismatch");
  });

  it("update returns null when not found", async () => {
    mockReturning.mockResolvedValueOnce([]);

    const result = await dao.update("nonexistent", {
      passed: true,
    });

    expect(result).toBeNull();
  });

  it("deleteByJobId calls db.delete", async () => {
    await dao.deleteByJobId("job-1");

    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});
