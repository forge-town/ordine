import { describe, expect, it, vi } from "vitest";
import { createAgentThreadsUpdateContextMethod } from "./agentThreadsUpdateContext.method";

describe("agentThreadsUpdateContext", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createAgentThreadsUpdateContextMethod({
      threadsDao: { update: vi.fn().mockResolvedValue(null) },
    } as never)("missing", {
      route: { pathname: "/pipelines" },
      capturedAt: new Date(0).toISOString(),
    } as never);
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "AgentThread",
      id: "missing",
    });
  });
});
