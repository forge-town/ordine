import { describe, expect, it, vi } from "vitest";
import { createExecuteDomainToolHelper } from "./executeDomainTool.helper";
import { err } from "neverthrow";
import { GetResourceInputSchema } from "@repo/agent-control";
describe("executeDomainTool", () => {
  it("retains the Agent Control contract boundary", async () => {
    const domain = { code: "RESOURCE_NOT_FOUND", message: "Missing", retryable: true };
    const input = GetResourceInputSchema.parse({ resourceType: "project", id: "missing" });
    const result = await createExecuteDomainToolHelper({
      resources: { get: vi.fn().mockResolvedValue(err(domain)) },
    } as never)("ordine.get_resource", input, "thread-1", "action-1");
    expect(result._unsafeUnwrapErr()).toEqual(domain);
  });
});
