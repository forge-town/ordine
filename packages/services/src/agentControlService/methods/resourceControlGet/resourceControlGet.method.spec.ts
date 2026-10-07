import { describe, expect, it, vi } from "vitest";
import { createResourceControlGetMethod } from "./resourceControlGet.method";

describe("resourceControlGet", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createResourceControlGetMethod({
      findById: vi.fn().mockResolvedValue(null),
    } as never)("project", "missing");
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});
