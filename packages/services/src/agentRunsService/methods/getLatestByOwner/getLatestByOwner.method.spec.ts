import { describe, expect, it, vi } from "vitest";
import { createGetLatestByOwnerMethod } from "./getLatestByOwner.method";

describe("getLatestByOwner", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const read = createGetLatestByOwnerMethod({
      runsDao: { findLatestByOwner: vi.fn().mockResolvedValue(null) },
      getPublicRun: vi.fn(),
    } as never);
    expect(await read("pipeline", "missing")).toBeNull();
  });
});
