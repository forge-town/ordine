import { describe, expect, it, vi } from "vitest";
import { createAgentThreadsCreateMethod } from "./agentThreadsCreate.method";

describe("agentThreadsCreate", () => {
  it("retains the Agent Control contract boundary", async () => {
    const cause = new Error("storage unavailable");
    const result = await createAgentThreadsCreateMethod({
      threadsDao: { create: vi.fn().mockRejectedValue(cause) },
    } as never)({ title: "Thread" });
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
});
