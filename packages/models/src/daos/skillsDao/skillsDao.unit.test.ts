import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createSkillsDao } from "./skillsDao";
import type { DbExecutor } from "../../types";

const mockReturning = vi.fn();
const mockLimit = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockOrderBy = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockOnConflictDoNothing = vi.fn(() => Promise.resolve());
const mockWhere = vi.fn(() => ({
  returning: mockReturning,
  limit: mockLimit,
  orderBy: mockOrderBy,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
}));
const mockValues = vi.fn(() => ({
  onConflictDoNothing: mockOnConflictDoNothing,
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
    eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
    desc: vi.fn((col) => ({ col, type: "desc" })),
  };
});

const makeRow = (id: string) => ({
  id,
  name: "skill",
  label: "Skill",
  description: "Desc",
  category: "code-quality",
  tags: [] as string[],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createSkillsDao(mockDb as unknown as DbExecutor);

describe("skillsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns ordered entities", async () => {
    const row = makeRow("skill-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("skill-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("skill-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("skill-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("skill-2");
  });

  it("findByName returns entity when found", async () => {
    const row = makeRow("skill-3");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findByName("skill");

    expect(result).not.toBeUndefined();
    expect(result?.name).toBe("skill");
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("skill-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "skill-4",
      name: "skill",
      label: "Skill",
      description: "Desc",
      category: "code-quality",
      tags: [],
    });

    expect(result.id).toBe("skill-4");
  });

  it("update returns entity on success", async () => {
    const row = makeRow("skill-5");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("skill-5", { label: "Updated" });

    expect(result).not.toBeUndefined();
  });

  it("delete calls db.delete", async () => {
    await dao.delete("skill-6");
    expect(mockWhere).toHaveBeenCalled();
  });

  it("seedIfEmpty inserts seed data when empty", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await dao.seedIfEmpty();

    expect(mockValues).toHaveBeenCalled();
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: "error-handling-best-practice",
          description: expect.stringContaining("neverthrow"),
          tags: expect.arrayContaining(["Neverthrow"]),
        }),
      ]),
    );
  });

  it("seedIfEmpty does nothing when data exists", async () => {
    mockLimit.mockResolvedValueOnce([makeRow("skill-1")]);

    await dao.seedIfEmpty();

    expect(mockValues).not.toHaveBeenCalled();
    expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
  });
});
