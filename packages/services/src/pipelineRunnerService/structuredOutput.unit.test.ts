import { describe, expect, it } from "vitest";
import { extractStructuredOutput, structuredJsonToMarkdown } from "./structuredOutput";

describe("structuredOutput", () => {
  describe("extractStructuredOutput", () => {
    it("extracts valid check JSON from raw text", () => {
      const input = JSON.stringify({
        type: "check",
        summary: "All good",
        findings: [],
        stats: {
          totalFiles: 5,
          totalFindings: 0,
          errors: 0,
          warnings: 0,
          infos: 0,
          skipped: 0,
        },
      });
      const result = extractStructuredOutput(input);
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe("check");
      expect(parsed.summary).toBe("All good");
    });

    it("extracts JSON from markdown fenced code block", () => {
      const input = `Some intro text
\`\`\`json
{"type":"check","summary":"found 2","findings":[{"id":"f1","severity":"error","message":"bad","file":"x.ts"}],"stats":{"totalFiles":1,"totalFindings":1,"errors":1,"warnings":0,"infos":0,"skipped":0}}
\`\`\`
Trailing text`;
      const result = extractStructuredOutput(input);
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe("check");
    });

    it("returns raw text when no valid JSON found", () => {
      const input = "This is just plain text with no JSON";
      const result = extractStructuredOutput(input);
      expect(result).toBe(input);
    });

    it("extracts valid fix JSON", () => {
      const input = JSON.stringify({
        type: "fix",
        summary: "Fixed 3 issues",
        changes: [{ file: "a.ts", action: "modified", description: "Removed console.log" }],
        remainingFindings: [],
        stats: {
          totalChanges: 1,
          filesModified: 1,
          findingsFixed: 1,
          findingsSkipped: 0,
        },
      });
      const result = extractStructuredOutput(input);
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe("fix");
    });
  });

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
      const md = structuredJsonToMarkdown(input);
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
      const md = structuredJsonToMarkdown(input);
      expect(md).toContain("# Fix Report");
      expect(md).toContain("Fixed 2 issues");
      expect(md).toContain("Added types");
    });

    it("returns raw content for non-JSON input", () => {
      const input = "Just plain text";
      expect(structuredJsonToMarkdown(input)).toBe(input);
    });
  });
});
