import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routinesDaoMock = {
  findManyEnabled: vi.fn(),
  update: vi.fn().mockResolvedValue(undefined),
};
const jobsDaoMock = {
  create: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createRoutinesDao: () => routinesDaoMock,
  createJobsDao: () => jobsDaoMock,
}));
vi.mock("@repo/logger", () => ({
  logger: { error: vi.fn() },
}));

import { createRoutineSchedulerService } from "./createRoutineSchedulerService";

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

  it("skips overlapping interval ticks while the previous one is in flight", async () => {
    vi.useFakeTimers();
    const firstTickGate = { release: () => {} };
    routinesDaoMock.findManyEnabled.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          firstTickGate.release = () => resolve([]);
        }),
    );
    const startRun = vi.fn().mockResolvedValue(ok({ jobId: "job-1" }));
    const service = createRoutineSchedulerService({} as never, { startRun });

    service.start();
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(1);

    // Two poll intervals elapse while the first tick is still awaiting the DB:
    // the in-flight guard must swallow both.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(1);

    firstTickGate.release();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(2);

    service.stop();
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
    expect(routinesDaoMock.update).toHaveBeenCalledWith("routine-1", {
      nextRunAt: new Date("2026-06-10T09:05:00.000Z"),
    });
    const updateOrder = routinesDaoMock.update.mock.invocationCallOrder[0]!;
    const createOrder = jobsDaoMock.create.mock.invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(createOrder);
  });

  it("start is idempotent and stop clears the interval", async () => {
    vi.useFakeTimers();
    const startRun = vi.fn().mockResolvedValue(ok({ jobId: "job-1" }));
    const service = createRoutineSchedulerService({} as never, { startRun });

    service.start();
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(1);

    service.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(1);
  });
});
