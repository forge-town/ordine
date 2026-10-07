import { describe, expect, it, vi } from "vitest";
import { createResourceControlDeleteMethod } from "./resourceControlDelete.method";

describe("resourceControlDelete", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createResourceControlDeleteMethod({
      findById: vi.fn().mockResolvedValue(null),
    } as never)("project", "missing");
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});
