import { describe, expect, it, vi } from "vitest";
import { createExecutionPreflightPipelineMethod } from "./executionPreflightPipeline.method";

describe("executionPreflightPipeline", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createExecutionPreflightPipelineMethod({
      pipelinesDao: { findById: vi.fn().mockResolvedValue(null) },
    } as never)("missing");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "PIPELINE_NOT_FOUND",
      field: "pipelineId",
    });
  });
});
