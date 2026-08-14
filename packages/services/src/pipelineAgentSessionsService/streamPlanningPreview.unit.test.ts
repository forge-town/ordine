import { describe, expect, it, vi } from "vitest";
import { createPlanningPreviewStreamer } from "./streamPlanningPreview";

const feedByCharacter = (value: string, onChunk: (chunk: string) => void) => {
  for (const character of value) onChunk(character);
};

describe("createPlanningPreviewStreamer", () => {
  it("streams only the generate planning field and decodes split JSON escapes", () => {
    const onChunk = vi.fn();
    const stream = createPlanningPreviewStreamer({ mode: "generate", onChunk });

    feedByCharacter(
      JSON.stringify({
        type: "proposal",
        question: 'Choose a "format".\nThen continue.',
        summary: "do not stream this",
        purpose: "also do not stream this",
      }),
      stream,
    );

    expect(onChunk.mock.calls.map(([chunk]) => chunk).join("")).toBe(
      'Choose a "format".\nThen continue.',
    );
    expect(onChunk.mock.calls.map(([chunk]) => chunk).join("")).not.toContain("do not stream this");
    expect(onChunk.mock.calls.length).toBeGreaterThan(1);
  });

  it("streams only the edit planning field", () => {
    const onChunk = vi.fn();
    const stream = createPlanningPreviewStreamer({ mode: "edit", onChunk });

    feedByCharacter(
      JSON.stringify({
        type: "proposal",
        summary: "Update the selected nodes.",
        purpose: "do not stream this",
      }),
      stream,
    );

    expect(onChunk.mock.calls.map(([chunk]) => chunk).join("")).toBe("Update the selected nodes.");
    expect(onChunk.mock.calls.map(([chunk]) => chunk).join("")).not.toContain("do not stream this");
  });
});
