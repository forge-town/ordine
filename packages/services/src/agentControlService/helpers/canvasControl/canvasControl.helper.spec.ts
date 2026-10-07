import { describe, expect, it, vi } from "vitest";
vi.mock("@repo/models", () => ({
  createAgentActionsDao: () => ({}),
  createAgentChangeSetsDao: () => ({}),
  createOperationsDao: () => ({}),
  createPipelinesDao: () => ({ findById: vi.fn().mockResolvedValue(null) }),
  createAgentControlRepository: () => ({}),
}));
import { createCanvasControl } from "./canvasControl.helper";
describe("canvasControl", () => {
  it("retains the missing-pipeline result across independently assembled Canvas controls", async () => {
    const first = createCanvasControl({} as never, () => "digest");
    const second = createCanvasControl({} as never, () => "digest");
    for (const canvas of [first, second]) {
      const result = await canvas.inspect({ pipelineId: "missing", limit: 10 });
      expect(result._unsafeUnwrapErr()).toMatchObject({ code: "PIPELINE_NOT_FOUND" });
    }
  });
});
