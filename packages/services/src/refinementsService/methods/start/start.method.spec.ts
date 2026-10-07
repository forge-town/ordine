import { beforeEach, describe, expect, it, vi } from "vitest";
const findDistillation = vi.fn();
const createRefinement = vi.fn();
const updateRefinement = vi.fn().mockResolvedValue(undefined);
vi.mock("@repo/models", () => ({
  createRefinementsDao: () => ({ create: createRefinement, update: updateRefinement }),
  createJobsDao: () => ({}),
  createDistillationsDao: () => ({ findById: findDistillation }),
  createPipelinesDao: () => ({}),
}));
vi.mock("../../../pipelinesService", () => ({
  createPipelinesService: () => ({
    optimizeFromDistillation: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../pipelineRunnerService", () => ({ createPipelineRunnerService: () => ({}) }));
vi.mock("../../../distillationsService", () => ({ createDistillationsService: () => ({}) }));
vi.mock("@repo/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
import { createRefinementsService } from "../../refinements.service";
describe("start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findDistillation.mockResolvedValue({ id: "source-1" });
    createRefinement.mockImplementation(async (data) => data);
  });
  it("does not create or launch a refinement when the source is missing", async () => {
    findDistillation.mockResolvedValueOnce(undefined);
    expect(
      await createRefinementsService({} as never).start({
        sourceDistillationId: "source-1",
        maxRounds: 2,
      }),
    ).toBeUndefined();
    expect(createRefinement).not.toHaveBeenCalled();
    expect(updateRefinement).not.toHaveBeenCalled();
  });
  it("returns the persisted refinement with the requested pending rounds before background optimization completes", async () => {
    const result = await createRefinementsService({} as never).start({
      sourceDistillationId: "source-1",
      maxRounds: 2,
    });
    expect(result).toMatchObject({
      sourceDistillationId: "source-1",
      maxRounds: 2,
      currentRound: 0,
      status: "running",
      rounds: [
        expect.objectContaining({ round: 1, status: "pending" }),
        expect.objectContaining({ round: 2, status: "pending" }),
      ],
    });
    await vi.waitFor(() => {
      expect(updateRefinement).toHaveBeenCalledWith(expect.any(String), { status: "completed" });
    });
  });
});
