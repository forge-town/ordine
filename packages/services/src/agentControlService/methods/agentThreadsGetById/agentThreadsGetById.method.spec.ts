import { describe, expect, it, vi } from "vitest";
import { createAgentThreadsGetByIdMethod } from "./agentThreadsGetById.method";

describe("agentThreadsGetById", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createAgentThreadsGetByIdMethod({
      threadsDao: { findById: vi.fn().mockResolvedValue(null) },
    } as never)("missing");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "AgentThread",
      id: "missing",
    });
  });
});
