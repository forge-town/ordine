import { type SchedulerRoutine } from "../../contracts";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { createRoutineScheduler } from "../../routineScheduler.service";

const makeRoutine = (overrides: Partial<SchedulerRoutine> = {}): SchedulerRoutine => ({
  id: "routine-1",
  pipelineId: "pipe-1",
  name: "Morning run",
  cronExpression: "*/5 * * * *",
  inputConfig: { prompt: "daily brief", ignored: 42 },
  enabled: true,
  lastRunAt: null,
  nextRunAt: new Date("2026-06-10T09:00:00.000Z"),
  ...overrides,
});

const makeDeps = (routines: SchedulerRoutine[]) => ({
  getEnabledRoutines: vi.fn().mockResolvedValue(routines),
  claimNextRun: vi.fn().mockResolvedValue(true),
  startRun: vi.fn().mockResolvedValue(ok({ jobId: "job-1" })),
  updateRoutine: vi.fn().mockResolvedValue(undefined),
  recordSkippedJob: vi.fn().mockResolvedValue(undefined),
  onError: vi.fn(),
});

describe("routine scheduler tick", () => {
  it("records a skipped job when startRun returns an error Result", async () => {
    const deps = makeDeps([makeRoutine()]);
    deps.startRun.mockResolvedValue(err(new Error("pipeline missing")));
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(deps.recordSkippedJob).toHaveBeenCalledWith({
      pipelineId: "pipe-1",
      routineId: "routine-1",
      routineName: "Morning run",
      reason: "Failed to start scheduled run: pipeline missing",
    });
    // No retry: the schedule advances and lastRunAt stays untouched.
    expect(deps.claimNextRun).toHaveBeenCalledWith(
      "routine-1",
      new Date("2026-06-10T09:00:00.000Z"),
      new Date("2026-06-10T09:05:00.000Z"),
    );
    expect(deps.startRun).toHaveBeenCalledTimes(1);
  });

  it("records a skipped job when startRun rejects", async () => {
    const deps = makeDeps([makeRoutine()]);
    deps.startRun.mockRejectedValue(new Error("connection refused"));
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(deps.recordSkippedJob).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "Failed to start scheduled run: connection refused",
      }),
    );
    expect(deps.claimNextRun).toHaveBeenCalledWith(
      "routine-1",
      new Date("2026-06-10T09:00:00.000Z"),
      new Date("2026-06-10T09:05:00.000Z"),
    );
  });
});
