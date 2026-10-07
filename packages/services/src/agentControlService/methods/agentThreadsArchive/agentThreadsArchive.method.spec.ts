import { describe, expect, it, vi } from "vitest";
import { createAgentThreadsArchiveMethod } from "./agentThreadsArchive.method";

describe("agentThreadsArchive", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createAgentThreadsArchiveMethod({
      threadsDao: { update: vi.fn().mockResolvedValue(null) },
    } as never)("missing");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "AgentThread",
      id: "missing",
    });
  });
});
