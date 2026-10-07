import { describe, expect, it } from "vitest";
import { createDefaultThreadIdMethod } from "./defaultThreadId.method";

describe("defaultThreadId", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(createDefaultThreadIdMethod({})("internal-run")).toBe(
      "agent-control-internal-run-local-owner",
    );
  });
});
