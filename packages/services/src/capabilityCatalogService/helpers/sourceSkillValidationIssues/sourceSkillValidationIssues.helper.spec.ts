import { describe, expect, it } from "vitest";
import { sourceSkillValidationIssues } from "./sourceSkillValidationIssues.helper";

describe("sourceSkillValidationIssues", () => {
  it("preserves catalog validation and presentation boundaries", () => {
    expect(sourceSkillValidationIssues(null, [], "sourceSkillId")).toEqual([]);
    expect(sourceSkillValidationIssues("missing", [], "operations[1].sourceSkillId")).toEqual([
      { path: "operations[1].sourceSkillId", reference: "missing", expectedKinds: ["skill"] },
    ]);
  });
});
