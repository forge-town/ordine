import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createRulesDao } from "./rulesDao";
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

const makeRow = (id: string, enabled = true) => ({
  id,
  name: "Rule",
  category: "custom" as const,
  severity: "warning" as const,
  enabled,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createRulesDao(mockDb as unknown as DbExecutor);

describe("rulesDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns entities without filter", async () => {
    const row = makeRow("rule-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("rule-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("rule-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("rule-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("rule-2");
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("rule-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "rule-3",
      name: "Rule",
      category: "custom",
      severity: "warning",
      enabled: true,
    });

    expect(result.id).toBe("rule-3");
  });

  it("toggleEnabled returns updated entity", async () => {
    const row = makeRow("rule-4", false);
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.toggleEnabled("rule-4", false);

    expect(result).not.toBeUndefined();
    expect(result?.enabled).toBe(false);
  });

  it("delete calls db.delete", async () => {
    await dao.delete("rule-5");
    expect(mockWhere).toHaveBeenCalled();
  });
});
