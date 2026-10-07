import { describe, expect, it, vi } from "vitest";
import { createEnsureThreadHelper } from "./ensureThread.helper";

describe("ensureThread", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createEnsureThreadHelper({
      threadsDao: { ensure: vi.fn().mockResolvedValue({ id: "stored" }) },
    } as never)({ audience: "external-mcp", threadId: null } as never);
    expect(result).toBe("agent-control-external-mcp-local-owner");
  });
});
