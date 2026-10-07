import { describe, expect, it, vi } from "vitest";
import { createAgentThreadsAddMessageMethod } from "./agentThreadsAddMessage.method";

describe("agentThreadsAddMessage", () => {
  it("retains the Agent Control contract boundary", async () => {
    const cause = new Error("storage unavailable");
    const result = await createAgentThreadsAddMessageMethod({
      messagesDao: { create: vi.fn().mockRejectedValue(cause) },
    } as never)({ threadId: "thread-1", role: "user", content: "Hello" });
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
});
