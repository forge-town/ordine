import { describe, expect, it, vi } from "vitest";
import { createGetLatestSessionForPipelineMethod } from "./getLatestSessionForPipeline.method";
describe("getLatestSessionForPipeline", () => {
  it("retains the session persistence boundary", async () => {
    const record = { id: "session-1", pipelineId: "pipeline-1" };
    const read = createGetLatestSessionForPipelineMethod({
      sessionsDao: { findLatestEditByPipelineId: vi.fn().mockResolvedValue(record) },
    } as never);
    expect(await read("pipeline-1")).toBe(record);
  });
});
