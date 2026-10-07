import { describe, expect, it } from "vitest";
import { resourceRef } from "./resourceControlResourceRef.helper";

describe("resourceControlResourceRef", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(resourceRef("project", { id: "project-1", name: "Project" })).toEqual({
      type: "project",
      id: "project-1",
      label: "Project",
    });
  });
});
