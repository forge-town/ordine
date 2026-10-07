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
  createPipelineAssetsDao: () => ({ create: operation }),
  createPipelinesDao: () => ({ findById: findPipeline }),
}));
import { createPipelineAssetsService } from "../../pipelineAssets.service";
describe("create", () => {
  it("returns the public asset result in Ok", async () => {
    const result = await createPipelineAssetsService({} as never).create({
      id: "asset-1",
      pipelineId: "pipeline-1",
      name: "Reusable brief",
      snapshotNodes: [],
      snapshotEdges: [],
      tags: ["brief"],
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(storedAsset);
  });
  it("retains persistence failures as typed ServiceError causes", async () => {
    const cause = new Error("storage unavailable");
    operation.mockRejectedValueOnce(cause);
    const result = await createPipelineAssetsService({} as never).create({
      id: "asset-1",
      pipelineId: "pipeline-1",
      name: "Reusable brief",
      snapshotNodes: [],
      snapshotEdges: [],
      tags: ["brief"],
    });
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
});
