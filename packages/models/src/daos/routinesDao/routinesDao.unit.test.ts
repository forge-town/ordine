import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createRoutinesDao } from "./routinesDao";
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
    asc: vi.fn((col) => ({ col, type: "asc" })),
  };
});

const makeRow = (id: string) => ({
  id,
  pipelineId: "pipeline-1",
  name: "Nightly",
  triggerType: "cron" as const,
  cronExpression: "0 0 * * *",
  eventType: null,
  eventConfig: null,
  inputConfig: null,
  enabled: true,
  lastRunAt: null,
  nextRunAt: new Date("2024-01-02"),
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createRoutinesDao(mockDb as unknown as DbExecutor);

describe("routinesDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAll returns ordered routines", async () => {
    const row = makeRow("routine-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("routine-1");
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("getById returns routine when found", async () => {
    const row = makeRow("routine-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.getById("routine-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("routine-2");
  });

  it("getByPipelineId returns routines for pipeline", async () => {
    const row = makeRow("routine-3");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getByPipelineId("pipeline-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.pipelineId).toBe("pipeline-1");
    expect(mockWhere).toHaveBeenCalled();
  });

  it("getEnabled returns enabled routines", async () => {
    const row = makeRow("routine-4");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getEnabled();

    expect(result).toHaveLength(1);
    expect(result[0]!.enabled).toBe(true);
    expect(mockWhere).toHaveBeenCalled();
  });

  it("create inserts and returns routine", async () => {
    const row = makeRow("routine-5");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "routine-5",
      pipelineId: "pipeline-1",
      name: "Nightly",
      triggerType: "cron",
      cronExpression: "0 0 * * *",
    });

    expect(result.id).toBe("routine-5");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("update patches and returns routine", async () => {
    const row = { ...makeRow("routine-6"), enabled: false };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("routine-6", { enabled: false });

    expect(result?.enabled).toBe(false);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("delete removes routine", async () => {
    await dao.delete("routine-7");

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});
