import { describe, expect, it } from "vitest";
import { createResourceControl } from "./resourceControl.helper";
describe("resourceControl", () => {
  it("exposes Jobs as read-only execution resources", () => {
    const result = createResourceControl({} as never).describe("job");
    expect(result._unsafeUnwrap().data).toEqual({
      resourceType: "job",
      create: null,
      update: null,
    });
  });
});
