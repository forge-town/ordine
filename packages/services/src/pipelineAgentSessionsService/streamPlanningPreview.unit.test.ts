import { describe, expect, it } from "vitest";
import { createPlanningPreviewStreamer } from "./streamPlanningPreview";

describe("createPlanningPreviewStreamer", () => {
  it("only emits the mode-specific safe field and never raw JSON", () => {
    const chunks: string[] = [];
    const preview = createPlanningPreviewStreamer({
      mode: "generate",
      onText: (text) => chunks.push(text),
    });

    preview.push('{"type":"proposal","proposal":{"mode":"generate","purpose":"Plan');
    preview.push(
      ' a review","inputs":["SECRET_TOOL_ARG"],"thinking":"fake ,\\"purpose\\":\\"SECRET_THINKING\\""}}',
    );

    expect(chunks.join("")).toBe("Plan a review");
    expect(chunks.join("")).not.toContain("SECRET");
    expect(chunks.join("")).not.toContain("purpose");
  });

  it("uses question and summary for edit planning", () => {
    const chunks: string[] = [];
    const preview = createPlanningPreviewStreamer({
      mode: "edit",
      onText: (text) => chunks.push(text),
    });

    preview.push('{"type":"question","question":"Which node?"}');

    expect(chunks.join("")).toBe("Which node?");
  });
});
