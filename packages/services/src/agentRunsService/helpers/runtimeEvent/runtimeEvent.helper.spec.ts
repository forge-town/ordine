import { describe, expect, it } from "vitest";
import { runtimeEvent } from "./runtimeEvent.helper";

describe("runtimeEvent", () => {
  it("retains the Agent Run boundary contract", () => {
    expect(runtimeEvent("codex", { type: "status", phase: "running" })).toMatchObject({
      runtime: "codex",
      type: "status",
      phase: "running",
    });
  });
});
