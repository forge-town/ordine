import { beforeEach, describe, expect, it, vi } from "vitest";
const nodes = [
  {
    id: "prompt-1",
    type: "prompt",
    metaType: "object",
    position: { x: 0, y: 0 },
    data: { label: "Brief", nodeType: "prompt", prompt: "Write a brief" },
  },
];
const pipeline = {
  id: "pipeline-1",
  name: "Brief",
  description: "Reusable report",
  nodes,
  edges: [],
  tags: [],
};
const findPipeline = vi.fn();
const findAssets = vi.fn();
const createAsset = vi.fn();
const updateAsset = vi.fn();
vi.mock("@repo/models", () => ({
  createPipelineAssetsDao: () => ({
    findManyByPipelineId: findAssets,
    create: createAsset,
    update: updateAsset,
  }),
  createPipelinesDao: () => ({ findById: findPipeline }),
}));
import { createPipelineAssetsService } from "../../pipelineAssets.service";
describe("distillFromPipeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findPipeline.mockResolvedValue(pipeline);
    findAssets.mockResolvedValue([]);
    createAsset.mockImplementation(async (data) => data);
    updateAsset.mockImplementation(async (id, patch) => ({ id, ...patch }));
  });
  it("creates a snapshot with object inputs and a nonempty name tag fallback", async () => {
    const result = await createPipelineAssetsService({} as never).distillFromPipeline("pipeline-1");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toMatchObject({
      pipelineId: "pipeline-1",
      name: "Brief",
      snapshotNodes: nodes,
      snapshotEdges: [],
      tags: ["Brief"],
      inputSlots: [{ nodeId: "prompt-1", label: "Brief", acceptTypes: ["prompt"] }],
    });
    expect(updateAsset).not.toHaveBeenCalled();
  });
  it("refreshes only the latest existing snapshot without overwriting edits or run statistics", async () => {
    findAssets.mockResolvedValueOnce([
      { id: "latest-asset", name: "User title", tags: ["edited"], totalRuns: 12 },
      { id: "older-asset" },
    ]);
    const result = await createPipelineAssetsService({} as never).distillFromPipeline("pipeline-1");
    expect(result.isOk()).toBe(true);
    expect(updateAsset).toHaveBeenCalledExactlyOnceWith("latest-asset", {
      snapshotNodes: nodes,
      snapshotEdges: [],
      inputSlots: [{ nodeId: "prompt-1", label: "Brief", acceptTypes: ["prompt"] }],
    });
    expect(createAsset).not.toHaveBeenCalled();
  });
  it("rejects an empty pipeline without persisting an unusable snapshot", async () => {
    findPipeline.mockResolvedValueOnce({ ...pipeline, nodes: [] });
    const result = await createPipelineAssetsService({} as never).distillFromPipeline("pipeline-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "ConflictError",
      message: 'Pipeline "pipeline-1" has no nodes to distill',
    });
    expect(findAssets).not.toHaveBeenCalled();
    expect(createAsset).not.toHaveBeenCalled();
  });
  it("reports a missing source pipeline", async () => {
    findPipeline.mockResolvedValueOnce(undefined);
    const result = await createPipelineAssetsService({} as never).distillFromPipeline("pipeline-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "Pipeline",
      id: "pipeline-1",
    });
  });
  it("reports an asset that disappears during refresh", async () => {
    findAssets.mockResolvedValueOnce([{ id: "latest-asset" }]);
    updateAsset.mockResolvedValueOnce(undefined);
    const result = await createPipelineAssetsService({} as never).distillFromPipeline("pipeline-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "PipelineAsset",
      id: "latest-asset",
    });
  });
});
