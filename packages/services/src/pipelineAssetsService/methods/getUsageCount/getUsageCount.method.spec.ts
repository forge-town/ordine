import { describe, expect, it, vi } from "vitest";
const storedAsset = {
  id: "asset-1",
  pipelineId: "pipeline-1",
  name: "Reusable brief",
  snapshotNodes: [],
  snapshotEdges: [],
  tags: ["brief"],
  totalRuns: 4,
  successRate: "0.7500",
};
const operation = vi.fn().mockResolvedValue(storedAsset);
const findPipeline = vi.fn().mockResolvedValue({ id: "pipeline-1" });
vi.mock("@repo/models", () => ({
  createPipelineAssetsDao: () => ({ findById: operation }),
  createPipelinesDao: () => ({ findById: findPipeline }),
}));
import { createPipelineAssetsService } from "../../pipelineAssets.service";
describe("getUsageCount", () => {
  it("returns the public asset source liveness count in Ok", async () => {
    const result = await createPipelineAssetsService({} as never).getUsageCount("asset-1");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({ assetId: "asset-1", count: 1 });
  });
  it("retains persistence failures as typed ServiceError causes", async () => {
    const cause = new Error("storage unavailable");
    operation.mockRejectedValueOnce(cause);
    const result = await createPipelineAssetsService({} as never).getUsageCount("asset-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
  it("reports an absent asset as NotFoundError", async () => {
    operation.mockResolvedValueOnce(undefined);
    const result = await createPipelineAssetsService({} as never).getUsageCount("asset-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "PipelineAsset",
      id: "asset-1",
    });
  });
  it("reports zero source usage when its original pipeline no longer exists", async () => {
    findPipeline.mockResolvedValueOnce(undefined);
    const result = await createPipelineAssetsService({} as never).getUsageCount("asset-1");
    expect(result._unsafeUnwrap()).toEqual({ assetId: "asset-1", count: 0 });
  });
});
