import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createProjectsDao } from "./projectsDao";
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
  name: "Test Project",
  description: "desc",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createProjectsDao(mockDb as unknown as DbExecutor);

describe("projectsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAll returns ordered projects", async () => {
    const row = makeRow("project-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("project-1");
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("getById returns project when found", async () => {
    const row = makeRow("project-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.getById("project-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("project-2");
  });

  it("create inserts and returns project", async () => {
    const row = makeRow("project-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "project-3",
      name: "Test Project",
      description: "desc",
    });

    expect(result.id).toBe("project-3");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("update patches and returns project", async () => {
    const row = { ...makeRow("project-4"), name: "Updated" };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("project-4", { name: "Updated" });

    expect(result?.name).toBe("Updated");
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
  });

  it("delete removes project", async () => {
    await dao.delete("project-5");

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});
