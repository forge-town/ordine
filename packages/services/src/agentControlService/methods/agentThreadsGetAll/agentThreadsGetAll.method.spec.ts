import { describe, expect, it, vi } from "vitest";
import { createAgentThreadsGetAllMethod } from "./agentThreadsGetAll.method";

describe("agentThreadsGetAll", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createAgentThreadsGetAllMethod({
      threadsDao: { findMany: vi.fn().mockResolvedValue([]) },
    } as never)();
    expect(result._unsafeUnwrap()).toEqual([]);
  });
});
