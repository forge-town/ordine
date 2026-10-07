import { describe, expect, it } from "vitest";
import { parseSkillFile } from "./parseSkillFile.helper";

describe("parseSkillFile", () => {
  it("preserves skill import and analysis metadata", () => {
    const candidate = parseSkillFile({
      path: "/fixtures/code-review/SKILL.md",
      content: "---\nname: Code Review\ndescription: Review changes carefully\n---\nBody",
    });
    expect(candidate).toEqual({
      id: "imported-code-review",
      name: "code-review",
      label: "Code Review",
      description: "Review changes carefully",
      path: "/fixtures/code-review/SKILL.md",
    });
  });
});
