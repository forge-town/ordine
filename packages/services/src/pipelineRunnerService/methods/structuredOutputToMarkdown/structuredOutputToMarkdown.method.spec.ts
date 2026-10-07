import { describe, expect, it } from "vitest";

import { structuredOutput } from "../../helpers/structuredOutput";

describe("structuredOutput", () => {
  describe("structuredJsonToMarkdown", () => {
    it("converts check report to markdown", () => {
      const input = JSON.stringify({
        type: "check",
        summary: "Found 1 issue",
        findings: [
          {
            id: "f1",
            severity: "error",
            message: "Missing return type",
            file: "src/index.ts",
            line: 10,
          },
        ],
        stats: {
          totalFiles: 3,
          totalFindings: 1,
          errors: 1,
          warnings: 0,
          infos: 0,
          skipped: 0,
        },
      });
      const md = structuredOutput.toMarkdown({ content: input });
      expect(md).toContain("# Check Report");
      expect(md).toContain("Found 1 issue");
      expect(md).toContain("Missing return type");
      expect(md).toContain("src/index.ts");
    });

    it("converts fix report to markdown", () => {
      const input = JSON.stringify({
        type: "fix",
        summary: "Fixed 2 issues",
        changes: [{ file: "a.ts", action: "replace", description: "Added types" }],
        remainingFindings: [],
        stats: {
          totalChanges: 1,
          filesModified: 1,
          findingsFixed: 2,
          findingsSkipped: 0,
        },
      });
      const md = structuredOutput.toMarkdown({ content: input });
      expect(md).toContain("# Fix Report");
      expect(md).toContain("Fixed 2 issues");
      expect(md).toContain("Added types");
    });

    it("returns raw content for non-JSON input", () => {
      const input = "Just plain text";
      expect(structuredOutput.toMarkdown({ content: input })).toBe(input);
    });

    it("unwraps a result envelope surrounded by agent prose", () => {
      const envelope = JSON.stringify({
        result: "# Review Report\n\nGenerated markdown body.",
        outputs: ["review.md"],
      });
      const input = `I will save the reviewed document.\n${envelope}\nDone.`;

      expect(structuredOutput.toMarkdown({ content: input })).toBe(
        "# Review Report\n\nGenerated markdown body.",
      );
    });
  });
});
