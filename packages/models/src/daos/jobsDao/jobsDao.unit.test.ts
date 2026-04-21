import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createJobsDao } from "./jobsDao";
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
    and: vi.fn((...args) => ({ type: "and", args })),
  };
});

const makeRow = (id: string, status: "queued" | "running" | "done" | "failed" | "cancelled" = "queued") => ({
  id,
  status,
  type: "pipeline_run" as const,
  title: "Job",
  projectId: null,
  pipelineId: null,
  result: null,
  logs: [] as string[],
  error: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createJobsDao(mockDb as unknown as DbExecutor);

describe("jobsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns entities without filter", async () => {
    const row = makeRow("job-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("job-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("job-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("job-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("job-2");
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("job-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "job-3",
      status: "queued",
      type: "pipeline_run",
      title: "Job",
    });

    expect(result.id).toBe("job-3");
  });

  it("updateStatus returns updated entity", async () => {
    const row = makeRow("job-4", "running");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.updateStatus("job-4", "running", { startedAt: new Date() });

    expect(result).not.toBeUndefined();
    expect(result?.status).toBe("running");
  });

  it("delete calls db.delete", async () => {
    await dao.delete("job-6");
    expect(mockWhere).toHaveBeenCalled();
  });
});
