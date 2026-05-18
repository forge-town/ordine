import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createOperationOutputItemTemplatesDao } from "./operationOutputItemTemplatesDao";
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
  };
});

const makeRow = (id: string) => ({
  id,
  name: "My Template",
  description: "A test template",
  content: "# Template\n\nContent here",
  contentType: "markdown" as const,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createOperationOutputItemTemplatesDao(mockDb as unknown as DbExecutor);

describe("operationOutputItemTemplatesDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns ordered entities", async () => {
    const row = makeRow("tpl-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("tpl-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("tpl-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("tpl-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("tpl-2");
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("tpl-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "tpl-3",
      name: "My Template",
      content: "# Template",
      contentType: "markdown",
    });

    expect(result.id).toBe("tpl-3");
  });

  it("update returns entity on success", async () => {
    const row = makeRow("tpl-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("tpl-4", { name: "Updated Template" });

    expect(result).not.toBeUndefined();
  });

  it("delete calls db.delete", async () => {
    await dao.delete("tpl-5");
    expect(mockWhere).toHaveBeenCalled();
  });
});
