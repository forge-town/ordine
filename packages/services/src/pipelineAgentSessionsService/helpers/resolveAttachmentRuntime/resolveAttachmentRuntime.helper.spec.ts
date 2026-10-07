import { describe, expect, it } from "vitest";
import { createResolveAttachmentRuntimeHelper } from "./resolveAttachmentRuntime.helper";
import { createResolveEffectiveRuntimeHelper } from "../resolveEffectiveRuntime";
describe("resolveAttachmentRuntime", () => {
  it("retains the planning and attachment boundary", () => {
    const resolve = createResolveAttachmentRuntimeHelper({
      resolveEffectiveRuntime: createResolveEffectiveRuntimeHelper({}),
    });
    expect(resolve({ requestedRuntimeId: "local-codex", runtimes: [] })).toBe("codex");
    expect(resolve({ requestedRuntimeId: "unknown", runtimes: [] })).toBeNull();
  });
});
