import { describe, expect, it, vi } from "vitest";
vi.mock("@repo/models", () => ({
  createAgentThreadsDao: () => ({ findById: vi.fn().mockResolvedValue(null) }),
  createPipelineAgentMessagesDao: () => ({}),
}));
import { createAgentThreadsService } from "./agentThreads.helper";
describe("agentThreads", () => {
  it("retains the public missing-thread contract through the assembled service", async () => {
    const result = await createAgentThreadsService({} as never).getById("missing");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "AgentThread",
      id: "missing",
    });
  });
});
