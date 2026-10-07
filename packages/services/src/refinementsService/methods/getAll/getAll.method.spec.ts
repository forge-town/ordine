import { describe, expect, it, vi } from "vitest";
import { createGetAllMethod } from "./getAll.method";
describe("getAll", () => {
  it("returns the persisted refinement result without changing the public shape", async () => {
    const persisted = [{ id: "refinement-1", status: "running" }];
    const dao = { findMany: vi.fn().mockResolvedValue(persisted) };
    expect(await createGetAllMethod(dao as never)()).toEqual(persisted);
  });
  it("preserves persistence rejection", async () => {
    const cause = new Error("storage unavailable");
    const dao = { findMany: vi.fn().mockRejectedValue(cause) };
    await expect(createGetAllMethod(dao as never)()).rejects.toBe(cause);
  });
});
