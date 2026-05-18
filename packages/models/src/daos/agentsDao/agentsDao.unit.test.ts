import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createAgentsDao } from "./agentsDao";
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
  limit: mockLimit,
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
    eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
    desc: vi.fn((col) => ({ col, type: "desc" })),
  };
});

const makeRow = (id: string) => ({
  id,
  name: "test-agent",
  description: "A test agent",
  defaultRuntime: null,
  systemPrompt: null,
  capabilities: [],
  allowedTools: [],
  allowedSkillIds: [],
  tags: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createAgentsDao(mockDb as unknown as DbExecutor);

describe("agentsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns ordered entities", async () => {
    const row = makeRow("agent-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("agent-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("agent-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("agent-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("agent-2");
  });

  it("findById returns undefined when not found", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const result = await dao.findById("nonexistent");

    expect(result).toBeUndefined();
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("agent-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "agent-3",
      name: "test-agent",
      description: "A test agent",
    });

    expect(result.id).toBe("agent-3");
  });

  it("update returns entity on success", async () => {
    const row = makeRow("agent-4");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("agent-4", { name: "Updated Agent" });

    expect(result).not.toBeUndefined();
  });

  it("delete calls db.delete", async () => {
    await dao.delete("agent-5");
    expect(mockWhere).toHaveBeenCalled();
  });
});
