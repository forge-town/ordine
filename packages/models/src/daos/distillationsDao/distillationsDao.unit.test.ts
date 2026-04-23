import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createDistillationsDao } from "./distillationsDao";
import type { DbExecutor } from "../../types";

const mockReturning = vi.fn();
const mockLimit = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockOrderBy = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockWhere = vi.fn(() => ({
  returning: mockReturning,
  limit: mockLimit,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  orderBy: mockOrderBy,
}));
const mockValues = vi.fn(() => ({
  returning: mockReturning,
}));
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
    desc: vi.fn((col) => ({ col, type: "desc" })),
    eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
  };
});

const makeRow = (id: string) => ({
  id,
  title: "Distill pipeline run",
  summary: "Summarize the strongest path",
  sourceType: "job" as const,
  sourceId: "job-1",
  sourceLabel: "Run: Sample",
  mode: "pipeline" as const,
  status: "draft" as const,
  config: { objective: "Extract reusable steps" },
  inputSnapshot: { traces: 12 },
  result: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createDistillationsDao(mockDb as unknown as DbExecutor);

describe("distillationsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns ordered records", async () => {
    mockOrderBy.mockResolvedValueOnce([makeRow("dst-1")]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("dst-1");
  });

  it("findById returns a record when found", async () => {
    mockLimit.mockResolvedValueOnce([makeRow("dst-2")]);

    const result = await dao.findById("dst-2");

    expect(result?.id).toBe("dst-2");
  });

  it("create inserts and returns a record", async () => {
    mockReturning.mockResolvedValueOnce([makeRow("dst-3")]);

    const result = await dao.create({
      id: "dst-3",
      title: "New distillation",
      summary: "",
      sourceType: "manual",
      sourceId: null,
      sourceLabel: "",
      mode: "knowledge",
      status: "draft",
      config: { objective: "" },
      inputSnapshot: null,
      result: null,
    });

    expect(result.id).toBe("dst-3");
  });

  it("update returns the updated record", async () => {
    mockReturning.mockResolvedValueOnce([makeRow("dst-4")]);

    const result = await dao.update("dst-4", { status: "completed" });

    expect(result?.id).toBe("dst-4");
  });

  it("delete calls db.delete", async () => {
    await dao.delete("dst-5");

    expect(mockWhere).toHaveBeenCalled();
  });
});
