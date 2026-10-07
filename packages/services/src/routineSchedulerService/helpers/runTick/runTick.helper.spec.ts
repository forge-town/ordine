import { ok } from "neverthrow";
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
    vi.advanceTimersByTime(60_000);
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(1);

    firstTickGate.release();
    await flushPromises();
    vi.advanceTimersByTime(30_000);
    await flushPromises();
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(2);

    service.stop();
  });
});
