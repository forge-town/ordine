import { describe, expect, it } from "vitest";
import { parseValidationTargets } from "./parseValidationTargets.helper";

describe("parseValidationTargets", () => {
  it("preserves catalog validation and presentation boundaries", () => {
    const result = parseValidationTargets([
      { sourceSkillId: 7, sourceSkillIdPath: "operations[0].sourceSkillId" },
    ]);
    expect(result.issues).toEqual([
      { path: "operations[0].sourceSkillId", message: "Expected a skill id string" },
    ]);
  });
});
