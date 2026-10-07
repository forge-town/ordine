import { describe, expect, it, vi } from "vitest";

const operation = vi.fn().mockResolvedValue(undefined);
vi.mock("@repo/models", () => ({ createConversationMessagesDao: () => ({ delete: operation }) }));
import { createConversationMessagesService } from "../../conversationMessages.service";
describe("delete", () => {
  it("returns successful completion for history removal", async () => {
    const service = createConversationMessagesService({} as never);
    const result = await service.delete("message-1");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(undefined);
  });
  it("maps persistence failures to ServiceError and retains their cause", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const service = createConversationMessagesService({} as never);
    const result = await service.delete("message-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause: error });
  });
});
