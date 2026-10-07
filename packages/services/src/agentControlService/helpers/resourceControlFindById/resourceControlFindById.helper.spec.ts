import { describe, expect, it, vi } from "vitest";
import { createResourceControlFindByIdHelper } from "./resourceControlFindById.helper";

describe("resourceControlFindById", () => {
  it("retains the Agent Control contract boundary", async () => {
    expect(
      await createResourceControlFindByIdHelper({
        daos: { project: { findById: vi.fn().mockResolvedValue(undefined) } },
      } as never)("project", "missing"),
    ).toBeNull();
  });
});
