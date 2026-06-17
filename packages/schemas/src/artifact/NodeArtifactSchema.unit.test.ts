import { describe, expect, it } from "vitest";
import { NodeArtifactSchema } from "./NodeArtifactSchema";

describe("NodeArtifactSchema", () => {
  it("parses an inline html artifact", () => {
    const parsed = NodeArtifactSchema.parse({
      kind: "inline",
      contentType: "html",
      content: "<h1>hello</h1>",
    });
    expect(parsed.kind).toBe("inline");
    expect(parsed.files).toBeUndefined();
  });

  it("parses a dir artifact with a file manifest", () => {
    const parsed = NodeArtifactSchema.parse({
      kind: "dir",
      contentType: "text",
      content: "/tmp/job-123/out",
      files: [
        { path: "Button.vue", contentType: "text" },
        { path: "tokens.css", contentType: "text", sizeBytes: 412 },
      ],
    });
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files?.[1]?.sizeBytes).toBe(412);
  });

  it("rejects an unknown kind", () => {
    expect(() =>
      NodeArtifactSchema.parse({ kind: "binary", contentType: "html" }),
    ).toThrow();
  });

  it("rejects an unknown contentType", () => {
    expect(() =>
      NodeArtifactSchema.parse({ kind: "inline", contentType: "pdf" }),
    ).toThrow();
  });
});
