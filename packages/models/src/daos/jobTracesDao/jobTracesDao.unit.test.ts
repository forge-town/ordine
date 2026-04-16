import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createJobTracesDao } from "./jobTracesDao";
import type { DbExecutor } from "../../types";

const mockReturning = vi.fn();
const mockOrderBy = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockWhere = vi.fn(() => ({
  returning: mockReturning,
  orderBy: mockOrderBy,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  orderBy: mockOrderBy,
}));
const mockValues = vi.fn(() => ({ returning: mockReturning }));

const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
  insert: vi.fn(() => ({ values: mockValues })),
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
  jobId: "job-1",
  message: "trace",
  level: "info" as const,
  createdAt: new Date("2024-01-01"),
});

const dao = createJobTracesDao(mockDb as unknown as DbExecutor);

describe("jobTracesDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("append inserts and returns trace", async () => {
    const row = makeRow("jt-1");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.append("job-1", "trace", "info");

    expect(result.id).toBe("jt-1");
    expect(result.level).toBe("info");
  });

  it("findByJobId returns ordered traces", async () => {
    const row = makeRow("jt-2");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findByJobId("job-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("jt-2");
  });

  it("deleteByJobId calls db.delete", async () => {
    await dao.deleteByJobId("job-1");
    expect(mockWhere).toHaveBeenCalled();
  });
});
