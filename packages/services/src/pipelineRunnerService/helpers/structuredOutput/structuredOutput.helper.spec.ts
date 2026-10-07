import { describe, expect, it } from "vitest";

import { structuredOutput } from "./";

describe("structuredOutput", () => {
  describe("structuredJsonToMarkdown", () => {
    it("unwraps agent result JSON into markdown content", () => {
      const input = JSON.stringify({
        outputs: { result: "/tmp/ordine-output/review-report.md" },
        result: "# Review Report\n\nGenerated markdown body.",
      });

      expect(structuredOutput.toMarkdown({ content: input })).toBe(
        "# Review Report\n\nGenerated markdown body.",
      );
    });
  });
});
