import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbExecutor } from "../../types";
import { createConversationMessagesDao } from "./conversationMessagesDao";

const message = {
  id: "message-1",
  pipelineId: "pipeline-1",
  role: "user" as const,
  content: "Build it",
  metadata: null,
  phase: null,
  createdAt: new Date("2026-01-01"),
};
const returning = vi.fn(() => Promise.resolve([message]));
const limit = vi.fn(() => Promise.resolve([message]));
const orderBy = vi.fn(() => Promise.resolve([message]));
const where = vi.fn(() => ({ limit, orderBy, returning }));
const from = vi.fn(() => ({ orderBy, where }));
const values = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));
const executor = {
  select: vi.fn(() => ({ from })),
  insert: vi.fn(() => ({ values })),
  update: vi.fn(() => ({ set })),
  delete: vi.fn(() => ({ where })),
} as unknown as DbExecutor;
const dao = createConversationMessagesDao(executor);

describe("ConversationMessagesDao", () => {
  beforeEach(() => vi.clearAllMocks());

  it("implements CRUD and pipeline-scoped reads", async () => {
    await expect(dao.findMany()).resolves.toEqual([message]);
    await expect(dao.findById(message.id)).resolves.toEqual(message);
    await expect(dao.findManyByPipelineId(message.pipelineId)).resolves.toEqual([message]);
    await expect(
      dao.create({
        id: message.id,
        pipelineId: message.pipelineId,
        role: message.role,
        content: message.content,
      }),
    ).resolves.toEqual(message);
    await expect(dao.update(message.id, { content: "Updated" })).resolves.toEqual(message);
    await expect(dao.delete(message.id)).resolves.toBeUndefined();

    expect(limit).toHaveBeenCalledWith(1);
    expect(orderBy).toHaveBeenCalledTimes(2);
  });
});
