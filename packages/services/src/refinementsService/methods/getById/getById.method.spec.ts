import { describe, expect, it, vi } from "vitest";
import { createGetByIdMethod } from "./getById.method";
describe("getById", () => {
  it("returns the persisted refinement result without changing the public shape", async () => {
    const persisted = undefined;
    const dao = { findById: vi.fn().mockResolvedValue(persisted) };
    expect(await createGetByIdMethod(dao as never)("refinement-1")).toEqual(persisted);
  });
  it("preserves persistence rejection", async () => {
    const cause = new Error("storage unavailable");
    const dao = { findById: vi.fn().mockRejectedValue(cause) };
    await expect(createGetByIdMethod(dao as never)("refinement-1")).rejects.toBe(cause);
  });
});
