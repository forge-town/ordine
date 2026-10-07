import { describe, expect, it, vi } from "vitest";

const operation = vi.fn().mockResolvedValue(undefined);
vi.mock("@repo/models", () => ({
  createDistillationsDao: () => ({ delete: operation }),
  createJobsDao: () => ({}),
  createJobTracesDao: () => ({}),
  createAgentRawExportsDao: () => ({}),
  createAgentSpansDao: () => ({}),
  createPipelinesDao: () => ({}),
  createSettingsDao: () => ({}),
}));
import { createDistillationsService } from "../../distillations.service";
describe("delete", () => {
  it("returns successful deletion completion", async () => {
    const result = await createDistillationsService({} as never).delete("dst-1");
    expect(result).toBeUndefined();
  });

  it("preserves persistence rejection for callers", async () => {
    const cause = new Error("storage unavailable");
    operation.mockRejectedValueOnce(cause);
    await expect(createDistillationsService({} as never).delete("dst-1")).rejects.toBe(cause);
  });
});
