import { describe, expect, it } from "vitest";
import { createBuildArtifactSummaryHelper } from "./buildArtifactSummary.helper";
describe("buildArtifactSummary", () => {
  it("uses visible summaries and falls back to the original content when no summary exists", () => {
    const summary = createBuildArtifactSummaryHelper({} as never);
    expect(summary([])).toBe("(none)");
    expect(
      summary([
        { kind: "text_extract", content: { summary: "source evidence" } },
        { kind: "structured_summary", content: { summary: "", text: "raw" } },
      ] as never),
    ).toBe('- text_extract: source evidence\n- structured_summary: {"summary":"","text":"raw"}');
  });
});
