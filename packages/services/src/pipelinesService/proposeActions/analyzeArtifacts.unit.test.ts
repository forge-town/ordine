import { describe, expect, it } from "vitest";
import { buildAnalyzeUserPrompt, parseArtifactAnalysis } from "./analyzeArtifacts";

describe("parseArtifactAnalysis", () => {
  it("parses a full stage-one payload", () => {
    expect(
      parseArtifactAnalysis({
        matchedComponentIds: ["op_1"],
        steps: ["parse", "summarize"],
        structure: "Quiz with 20 questions",
      }),
    ).toEqual({
      matchedComponentIds: ["op_1"],
      steps: ["parse", "summarize"],
      structure: "Quiz with 20 questions",
    });
  });

  it("rejects payloads without a structure and filters non-string entries", () => {
    expect(parseArtifactAnalysis({ steps: ["a"] })).toBeUndefined();
    expect(parseArtifactAnalysis(null)).toBeUndefined();
    expect(
      parseArtifactAnalysis({ matchedComponentIds: [1, "op_2"], steps: [true], structure: "x" }),
    ).toEqual({ matchedComponentIds: ["op_2"], steps: [], structure: "x" });
  });
});

describe("buildAnalyzeUserPrompt", () => {
  it("includes artifact content and marks binary files", () => {
    const prompt = buildAnalyzeUserPrompt({
      attachments: [
        { content: "# Notes", name: "notes.md", type: "text/markdown" },
        { name: "photo.png", type: "image/png" },
      ],
      message: "逆向这个样本",
      operationCatalog: [],
    });

    expect(prompt).toContain("Artifact 1: notes.md (text/markdown)");
    expect(prompt).toContain("# Notes");
    expect(prompt).toContain("Artifact 2: photo.png (image/png)");
    expect(prompt).toContain("(binary — filename only)");
    expect(prompt).toContain("逆向这个样本");
  });
});
