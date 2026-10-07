import { describe, expect, it, vi } from "vitest";
import { createResourceControlListHelper } from "./resourceControlList.helper";

describe("resourceControlList", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createResourceControlListHelper({
      daos: { project: { findMany: vi.fn().mockResolvedValue([{ id: "project-1" }]) } },
    } as never)("project");
    expect(result).toEqual([{ id: "project-1" }]);
  });
});
