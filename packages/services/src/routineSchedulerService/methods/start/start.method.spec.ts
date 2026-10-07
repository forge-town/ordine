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

  it("start is idempotent and stop clears the interval", async () => {
    vi.useFakeTimers();
    const startRun = vi.fn().mockResolvedValue(ok({ jobId: "job-1" }));
    const service = createRoutineSchedulerService({} as never, { startRun });

    service.start();
    service.start();
    vi.advanceTimersByTime(0);
    await flushPromises();
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(1);

    service.stop();
    vi.advanceTimersByTime(120_000);
    await flushPromises();
    expect(routinesDaoMock.findManyEnabled).toHaveBeenCalledTimes(1);
  });
});
