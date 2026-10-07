import { describe, expect, it, vi } from "vitest";
const storedRecord = {
  id: "dst-1",
  title: "Distill job run",
  summary: "",
  sourceType: "job" as const,
  sourceId: "job-1",
  sourceLabel: "Run job-1",
  mode: "pipeline" as const,
  status: "draft" as const,
  config: { objective: "Find decisive evidence" },
  inputSnapshot: null,
  result: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const operation = vi.fn().mockResolvedValue(storedRecord);
vi.mock("@repo/models", () => ({
  createDistillationsDao: () => ({ update: operation }),
  createJobsDao: () => ({}),
  createJobTracesDao: () => ({}),
  createAgentRawExportsDao: () => ({}),
  createAgentSpansDao: () => ({}),
  createPipelinesDao: () => ({}),
  createSettingsDao: () => ({}),
}));
import { createDistillationsService } from "../../distillations.service";
describe("update", () => {
  it("returns normalized distillation content with public metadata", async () => {
    const result = await createDistillationsService({} as never).update("dst-1", {
      title: "Edited distillation",
    });
    expect(result).toMatchObject({
      id: "dst-1",
      config: { objective: "Find decisive evidence" },
      result: null,
      meta: { createdAt: new Date(0), updatedAt: new Date(0) },
    });
    expect(result).not.toHaveProperty("createdAt");
  });
  it("returns undefined for an absent distillation", async () => {
    operation.mockResolvedValueOnce(undefined);
    const result = await createDistillationsService({} as never).update("dst-1", {
      title: "Edited distillation",
    });
    expect(result).toBeUndefined();
  });
  it("preserves persistence rejection for callers", async () => {
    const cause = new Error("storage unavailable");
    operation.mockRejectedValueOnce(cause);
    await expect(
      createDistillationsService({} as never).update("dst-1", { title: "Edited distillation" }),
    ).rejects.toBe(cause);
  });
});
