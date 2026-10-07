import { describe, expect, it, vi } from "vitest";
const storedMessage = {
  id: "message-1",
  pipelineId: "pipeline-1",
  role: "user",
  content: "Run this pipeline",
  metadata: null,
  phase: null,
  createdAt: new Date(0),
};
const operation = vi.fn().mockResolvedValue([storedMessage]);
vi.mock("@repo/models", () => ({
  createConversationMessagesDao: () => ({ findManyByPipelineId: operation }),
}));
import { createConversationMessagesService } from "../../conversationMessages.service";
describe("getByPipelineId", () => {
  it("retains stored conversation data in an Ok result", async () => {
    const service = createConversationMessagesService({} as never);
    const result = await service.getByPipelineId("pipeline-1", 2);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([storedMessage]);
  });
  it("maps persistence failures to ServiceError and retains their cause", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const service = createConversationMessagesService({} as never);
    const result = await service.getByPipelineId("pipeline-1", 2);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause: error });
  });
});
