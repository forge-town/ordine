import { describe, expect, it, vi } from "vitest";
import { createAgentThreadsGetMessagesMethod } from "./agentThreadsGetMessages.method";

describe("agentThreadsGetMessages", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createAgentThreadsGetMessagesMethod({
      messagesDao: { findManyBySessionId: vi.fn().mockResolvedValue([]) },
    } as never)("thread-1");
    expect(result._unsafeUnwrap()).toEqual([]);
  });
});
