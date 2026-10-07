import { describe, expect, it, vi, afterEach } from "vitest";
const findManyEnabled = vi.fn().mockResolvedValue([]);
vi.mock("@repo/models", () => ({
  createRoutinesDao: () => ({ findManyEnabled }),
  createJobsDao: () => ({}),
}));
vi.mock("@repo/logger", () => ({ logger: { error: vi.fn() } }));
import { createRoutineSchedulerService } from "../../routineScheduler.service";
import { ok } from "neverthrow";
describe("stop", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("is harmless before start and allows a stopped scheduler to restart", async () => {
    vi.useFakeTimers();
    findManyEnabled.mockClear();
    const service = createRoutineSchedulerService({} as never, {
      startRun: vi.fn().mockResolvedValue(ok({ jobId: "job-1" })),
    });
    service.stop();
    service.start();
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    service.stop();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(findManyEnabled).toHaveBeenCalledTimes(1);
    service.start();
    expect(findManyEnabled).toHaveBeenCalledTimes(2);
    service.stop();
  });
});
