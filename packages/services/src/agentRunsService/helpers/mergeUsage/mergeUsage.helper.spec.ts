import { describe, expect, it } from "vitest";
import { mergeUsage } from "./mergeUsage.helper";
import { RuntimeEventSchema } from "@repo/schemas";
describe("mergeUsage", () => {
  it("retains the Agent Run boundary contract", () => {
    const usage = { inputTokens: 10, outputTokens: 2 };
    const event = RuntimeEventSchema.parse({
      runtime: "codex",
      timestamp: new Date(0).toISOString(),
      type: "usage",
      outputTokens: 5,
    });
    expect(mergeUsage(usage, event)).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(usage.outputTokens).toBe(2);
  });
});
