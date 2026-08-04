import { describe, expect, it } from "vitest";
import { PipelineSchema } from "./PipelineSchema";

const basePipeline = {
  id: "pipeline-1",
  name: "Pipeline",
  description: "",
  sharedContext: "",
  tags: [],
  timeoutMs: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  nodes: [],
  edges: [],
};

describe("PipelineSchema", () => {
  it("accepts project, status, and version metadata", () => {
    const parsed = PipelineSchema.parse({
      ...basePipeline,
      projectId: "project-1",
      status: "draft",
      version: 2,
    });

    expect(parsed).toMatchObject({ projectId: "project-1", status: "draft", version: 2 });
  });

  it("keeps legacy pipeline payloads compatible", () => {
    expect(PipelineSchema.parse(basePipeline)).toMatchObject({ id: "pipeline-1" });
  });
});
