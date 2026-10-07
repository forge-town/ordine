import { describe, expect, it } from "vitest";
import { isOutputEvent } from "./isOutputEvent.helper";
import { RuntimeEventSchema } from "@repo/schemas";
describe("isOutputEvent", () => {
  it("retains the Agent Run boundary contract", () => {
    const base = { runtime: "codex", timestamp: new Date(0).toISOString() };
    expect(
      isOutputEvent(RuntimeEventSchema.parse({ ...base, type: "status", phase: "running" })),
    ).toBe(false);
    expect(
      isOutputEvent(RuntimeEventSchema.parse({ ...base, type: "text_delta", text: "output" })),
    ).toBe(true);
  });
});
