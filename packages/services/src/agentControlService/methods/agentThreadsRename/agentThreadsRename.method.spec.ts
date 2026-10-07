import { describe, expect, it, vi } from "vitest";
import { createAgentThreadsRenameMethod } from "./agentThreadsRename.method";

describe("agentThreadsRename", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createAgentThreadsRenameMethod({
      threadsDao: { update: vi.fn().mockResolvedValue(null) },
    } as never)("missing", "Title");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "AgentThread",
      id: "missing",
    });
  });
});
