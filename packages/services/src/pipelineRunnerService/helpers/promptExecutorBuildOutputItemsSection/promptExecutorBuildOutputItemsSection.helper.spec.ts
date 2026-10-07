import { describe, expect, it } from "vitest";
import { createPromptExecutorBuildOutputItemsSectionHelper } from "./promptExecutorBuildOutputItemsSection.helper";
describe("promptExecutorBuildOutputItemsSection", () => {
  it("retains the runner data and state boundary", () => {
    const build = createPromptExecutorBuildOutputItemsSectionHelper({});
    expect(build()).toBe("");
    const prompt = build(
      [{ name: "report", contentType: "markdown", templateIds: [], description: "Review results" }],
      "/output",
    );
    expect(prompt).toContain("Write all output files to the directory: /output");
    expect(prompt).toContain("**report** (markdown): Review results");
  });
});
