import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createConnectorsDao } from "./connectorsDao";
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
  name: "GitHub",
  method: "direct-api" as const,
  status: "needs_setup" as const,
  scopes: null,
  config: {},
  lastSyncAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createConnectorsDao(mockDb as unknown as DbExecutor);

describe("connectorsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAll returns ordered connectors", async () => {
    const row = makeRow("connector-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("connector-1");
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("getById returns connector when found", async () => {
    const row = makeRow("connector-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.getById("connector-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("connector-2");
  });

  it("create inserts and returns connector", async () => {
    const row = makeRow("connector-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "connector-3",
      name: "GitHub",
      method: "direct-api",
      config: {},
    });

    expect(result.id).toBe("connector-3");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("update patches and returns connector", async () => {
    const row = { ...makeRow("connector-4"), status: "connected" as const };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("connector-4", { status: "connected" });

    expect(result?.status).toBe("connected");
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "connected" }));
  });

  it("delete removes connector", async () => {
    await dao.delete("connector-5");

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});
