import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createConversationMessagesDao } from "./conversationMessagesDao";
import type { DbExecutor } from "../../types";

const mockReturning = vi.fn();
const mockLimit = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockOrderedLimit = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
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
  role: "user" as const,
  content: "Build it",
  metadata: null,
  phase: null,
  createdAt: new Date("2024-01-01"),
});

const dao = createConversationMessagesDao(mockDb as unknown as DbExecutor);

describe("conversationMessagesDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAll returns ordered messages", async () => {
    const row = makeRow("message-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getAll();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("message-1");
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("getById returns message when found", async () => {
    const row = makeRow("message-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.getById("message-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("message-2");
  });

  it("getByPipelineId returns messages in ascending creation order", async () => {
    const row = makeRow("message-3");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.getByPipelineId("pipeline-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.pipelineId).toBe("pipeline-1");
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("getByPipelineId applies optional limit", async () => {
    const row = makeRow("message-4");
    mockOrderBy.mockReturnValueOnce({ limit: mockOrderedLimit } as unknown as Promise<
      Record<string, unknown>[]
    >);
    mockOrderedLimit.mockResolvedValueOnce([row]);

    const result = await dao.getByPipelineId("pipeline-1", 5);

    expect(result).toHaveLength(1);
    expect(mockOrderedLimit).toHaveBeenCalledWith(5);
  });

  it("create inserts and returns message", async () => {
    const row = makeRow("message-5");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "message-5",
      pipelineId: "pipeline-1",
      role: "user",
      content: "Build it",
    });

    expect(result.id).toBe("message-5");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("update patches and returns message", async () => {
    const row = { ...makeRow("message-6"), content: "Updated" };
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.update("message-6", { content: "Updated" });

    expect(result?.content).toBe("Updated");
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ content: "Updated" }));
  });

  it("delete removes message", async () => {
    await dao.delete("message-7");

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });
});
