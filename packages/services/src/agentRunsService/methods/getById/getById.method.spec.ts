import { describe, expect, it, vi } from "vitest";
import { createGetByIdMethod } from "./getById.method";

describe("getById", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const read = createGetByIdMethod({
      runsDao: { findById: vi.fn().mockResolvedValue(null) },
      getPublicRun: vi.fn(),
    } as never);
    expect(await read("missing")).toBeNull();
  });
});
