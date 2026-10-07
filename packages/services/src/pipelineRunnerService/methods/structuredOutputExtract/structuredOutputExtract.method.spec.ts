import { describe, expect, it } from "vitest";

import { structuredOutput } from "../../helpers/structuredOutput";

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
      const result = structuredOutput.extract({ rawText: input });
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
      const result = structuredOutput.extract({ rawText: input });
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe("check");
    });

    it("returns raw text when no valid JSON found", () => {
      const input = "This is just plain text with no JSON";
      const result = structuredOutput.extract({ rawText: input });
      expect(result).toBe(input);
    });

    // Since extraction goes through the shared extractJsonFromText, a bare {...}
    // embedded in prose is also extracted (previously only ```json fences were).
    // This case pins down that intentionally widened behavior.
    it("extracts an embedded bare JSON object surrounded by prose (widened behavior)", () => {
      const payload = {
        type: "check",
        summary: "ok",
        findings: [],
        stats: {
          totalFiles: 1,
          totalFindings: 0,
          errors: 0,
          warnings: 0,
          infos: 0,
          skipped: 0,
        },
      };
      const input = `Sure, here is the result: ${JSON.stringify(payload)} — done.`;
      const result = structuredOutput.extract({ rawText: input });
      expect(JSON.parse(result).type).toBe("check");
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
      const result = structuredOutput.extract({ rawText: input });
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe("fix");
    });
  });
});
