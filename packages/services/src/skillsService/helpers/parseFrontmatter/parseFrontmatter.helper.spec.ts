import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./parseFrontmatter.helper";

describe("parseFrontmatter", () => {
  it("preserves skill import and analysis metadata", () => {
    const result = parseFrontmatter(
      "---\nname: 'Code Review'\ndescription: |\n  Check changes\n  Keep evidence\n---\n# Body",
    );
    expect(result.fields.get("name")).toBe("Code Review");
    expect(result.fields.get("description")).toBe("Check changes\nKeep evidence");
    expect(result.body).toBe("# Body");
    expect(parseFrontmatter("---\nunterminated").body).toBe("---\nunterminated");
  });
});
