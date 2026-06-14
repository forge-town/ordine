import { describe, expect, it } from "vitest";
import { PipelineSchema } from "./PipelineSchema";

const basePipeline = {
  id: "pipeline-1",
  name: "Test pipeline",
  tags: [],
  timeoutMs: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  nodes: [],
  edges: [],
};

describe("PipelineSchema", () => {
  it("parses legacy rows without a version and defaults it to 1", () => {
    const parsed = PipelineSchema.parse(basePipeline);

    expect(parsed.version).toBe(1);
  });

  it("keeps an explicit version", () => {
    const parsed = PipelineSchema.parse({ ...basePipeline, version: 4 });

    expect(parsed.version).toBe(4);
  });

  it("rejects non-positive versions", () => {
    expect(PipelineSchema.safeParse({ ...basePipeline, version: 0 }).success).toBe(false);
  });
});
