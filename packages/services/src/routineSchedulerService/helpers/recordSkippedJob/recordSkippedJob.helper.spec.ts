import { err } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routinesDaoMock = {
  findManyEnabled: vi.fn(),
  claimNextRun: vi.fn().mockResolvedValue(true),
  update: vi.fn().mockResolvedValue(undefined),
};
const jobsDaoMock = {
  create: vi.fn().mockResolvedValue(undefined),
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

vi.mock("@repo/models", () => ({
  createRoutinesDao: () => routinesDaoMock,
  createJobsDao: () => jobsDaoMock,
}));
vi.mock("@repo/logger", () => ({
  logger: { error: vi.fn() },
}));

import { createRoutineSchedulerService } from "../../routineScheduler.service";

const dueRoutine = {
  id: "routine-1",
  pipelineId: "pipe-1",
  name: "Morning run",
  cronExpression: "*/5 * * * *",
  inputConfig: null,
  enabled: true,
  lastRunAt: null,
  nextRunAt: new Date("2026-06-10T09:00:00.000Z"),
};

describe("createRoutineSchedulerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routinesDaoMock.findManyEnabled.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists failed triggers as skipped jobs after advancing the schedule", async () => {
    routinesDaoMock.findManyEnabled.mockResolvedValue([dueRoutine]);
    const startRun = vi.fn().mockResolvedValue(err(new Error("pipeline missing")));
    const service = createRoutineSchedulerService({} as never, { startRun });

    await service.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(jobsDaoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Routine skipped: Morning run",
        type: "pipeline_run",
        status: "skipped",
        triggeredBy: "routine",
        pipelineId: "pipe-1",
        error: "Failed to start scheduled run: pipeline missing",
      }),
    );
    expect(startRun).toHaveBeenCalledWith({
      inputs: {},
      jobId: "routine:routine-1:2026-06-10T09:00:00.000Z",
      pipelineId: "pipe-1",
      triggeredBy: "routine",
    });
    expect(routinesDaoMock.claimNextRun).toHaveBeenCalledWith(
      "routine-1",
      new Date("2026-06-10T09:00:00.000Z"),
      new Date("2026-06-10T09:05:00.000Z"),
    );
    const updateOrder = routinesDaoMock.claimNextRun.mock.invocationCallOrder[0]!;
    const createOrder = jobsDaoMock.create.mock.invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(createOrder);
  });
});
