import { describe, expect, it } from "vitest";
import { toMessage } from "./agentThreadsToMessage.helper";

describe("agentThreadsToMessage", () => {
  it("retains the Agent Control contract boundary", () => {
    const result = toMessage({
      id: "message-1",
      sessionId: "thread-1",
      role: "user",
      kind: "text",
      content: "Hello",
      createdAt: new Date(0),
    } as never);
    expect(result).toMatchObject({ id: "message-1", content: "Hello", role: "user" });
  });
});
