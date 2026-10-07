import { describe, expect, it, vi } from "vitest";
import { createDeleteMethod } from "./delete.method";
describe("delete", () => {
  it("returns the persisted refinement result without changing the public shape", async () => {
    const persisted = undefined;
    const dao = { delete: vi.fn().mockResolvedValue(persisted) };
    expect(await createDeleteMethod(dao as never)("refinement-1")).toEqual(persisted);
  });
  it("preserves persistence rejection", async () => {
    const cause = new Error("storage unavailable");
    const dao = { delete: vi.fn().mockRejectedValue(cause) };
    await expect(createDeleteMethod(dao as never)("refinement-1")).rejects.toBe(cause);
  });
});
