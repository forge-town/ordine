import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createGithubProjectsDao } from "./githubProjectsDao";
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
  name: "Repo",
  owner: "owner",
  repo: "repo",
  githubUrl: "https://github.com/owner/repo",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createGithubProjectsDao(mockDb as unknown as DbExecutor);

describe("githubProjectsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns ordered entities", async () => {
    const row = makeRow("gp-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("gp-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("gp-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("gp-2");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("gp-2");
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("gp-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "gp-3",
      name: "Repo",
      owner: "owner",
      repo: "repo",
      githubUrl: "https://github.com/owner/repo",
    });

    expect(result.id).toBe("gp-3");
  });

  it("update returns entity on success", async () => {
    const row = makeRow("gp-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("gp-4", { repo: "updated" });

    expect(result).not.toBeNull();
  });

  it("delete calls db.delete", async () => {
    await dao.delete("gp-5");
    expect(mockWhere).toHaveBeenCalled();
  });
});
