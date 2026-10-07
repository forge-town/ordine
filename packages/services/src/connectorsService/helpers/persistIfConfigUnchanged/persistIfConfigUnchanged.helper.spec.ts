import { describe, expect, it, vi } from "vitest";
import type { ConnectorsDao } from "./";
import { persistIfConfigUnchanged } from "./persistIfConfigUnchanged.helper";
describe("persistIfConfigUnchanged", () => {
  it("distinguishes a concurrent edit from a concurrent removal", async () => {
    const findById = vi.fn().mockResolvedValue({ id: "connector-1" });
    const updateIfConfigUnchanged = vi.fn().mockResolvedValue(undefined);
    const dao = { findById, updateIfConfigUnchanged } as unknown as ConnectorsDao;
    const expected = { method: "mcp" as const, config: {} };
    const conflict = await persistIfConfigUnchanged(
      dao,
      "connector-1",
      expected,
      { status: "error" },
      "changed during handshake",
    );
    expect(conflict._unsafeUnwrapErr()).toMatchObject({
      name: "ConflictError",
      message: "changed during handshake",
    });
    findById.mockResolvedValueOnce(undefined);
    const removed = await persistIfConfigUnchanged(
      dao,
      "connector-1",
      expected,
      { status: "error" },
      "changed during handshake",
    );
    expect(removed._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "Connector",
      id: "connector-1",
    });
  });
});
