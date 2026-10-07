import { describe, expect, it, vi } from "vitest";

const operation = vi.fn().mockResolvedValue(undefined);
const findPipeline = vi.fn().mockResolvedValue({ id: "pipeline-1" });
vi.mock("@repo/models", () => ({
  createPipelineAssetsDao: () => ({ delete: operation }),
  createPipelinesDao: () => ({ findById: findPipeline }),
}));
import { createPipelineAssetsService } from "../../pipelineAssets.service";
describe("delete", () => {
  it("returns the public asset result in Ok", async () => {
    const result = await createPipelineAssetsService({} as never).delete("asset-1");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(undefined);
  });
  it("retains persistence failures as typed ServiceError causes", async () => {
    const cause = new Error("storage unavailable");
    operation.mockRejectedValueOnce(cause);
    const result = await createPipelineAssetsService({} as never).delete("asset-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
});
