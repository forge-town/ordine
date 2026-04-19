import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createSettingsDao } from "./settingsDao";
import type { DbExecutor } from "../../types";

const mockReturning = vi.fn();
const mockLimit = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
const mockWhere = vi.fn(() => ({
  returning: mockReturning,
  limit: mockLimit,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
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
};

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
  };
});

const makeRow = () => ({
  id: "default",
  llmProvider: null,
  llmApiKey: null,
  llmModel: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createSettingsDao(mockDb as unknown as DbExecutor);

describe("settingsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("get returns existing settings", async () => {
    const row = makeRow();
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.get();

    expect(result.id).toBe("default");
    expect(mockValues).not.toHaveBeenCalled();
  });

  it("get creates default settings when not found", async () => {
    mockLimit.mockResolvedValueOnce([]);
    const row = makeRow();
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.get();

    expect(result.id).toBe("default");
    expect(mockValues).toHaveBeenCalled();
  });

  it("get reloads settings when insert conflicts with another writer", async () => {
    const row = makeRow();
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
    mockReturning.mockResolvedValueOnce([]);

    const result = await dao.get();

    expect(result.id).toBe("default");
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
  });

  it("update returns updated settings", async () => {
    const row = makeRow();
    mockLimit.mockResolvedValueOnce([row]);
    const updatedRow = { ...row, llmProvider: "mastra" };
    mockReturning.mockResolvedValueOnce([updatedRow]);

    const result = await dao.update({ llmProvider: "mastra" });

    expect(result.id).toBe("default");
    expect(result.llmProvider).toBe("mastra");
  });
});
