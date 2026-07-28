import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import {
  createRoutineScheduler,
  DEFAULT_GRACE_WINDOW_MS,
  type SchedulerRoutine,
} from "./routineScheduler";

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
  it("starts due routines within the grace window as routine-triggered jobs", async () => {
    const deps = makeDeps([makeRoutine()]);
    const scheduler = createRoutineScheduler(deps);

    const now = new Date("2026-06-10T09:00:30.000Z");
    await scheduler.tick(now);

    expect(deps.startRun).toHaveBeenCalledWith({
      inputs: { prompt: "daily brief" },
      jobId: "routine:routine-1:2026-06-10T09:00:00.000Z",
      pipelineId: "pipe-1",
      triggeredBy: "routine",
    });
    expect(deps.recordSkippedJob).not.toHaveBeenCalled();
    expect(deps.claimNextRun).toHaveBeenCalledWith(
      "routine-1",
      new Date("2026-06-10T09:00:00.000Z"),
      new Date("2026-06-10T09:05:00.000Z"),
    );
    expect(deps.updateRoutine).toHaveBeenCalledWith("routine-1", {
      lastRunAt: now,
    });
    const claimOrder = deps.claimNextRun.mock.invocationCallOrder[0]!;
    const startOrder = deps.startRun.mock.invocationCallOrder[0]!;
    expect(claimOrder).toBeLessThan(startOrder);
  });

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

  it("claims the schedule before writing the skipped record", async () => {
    const deps = makeDeps([makeRoutine()]);
    deps.startRun.mockResolvedValue(err(new Error("boom")));
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    const updateOrder = deps.claimNextRun.mock.invocationCallOrder[0]!;
    const skipOrder = deps.recordSkippedJob.mock.invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(skipOrder);
  });

  it("still claims the schedule when the skipped write itself fails", async () => {
    const deps = makeDeps([makeRoutine()]);
    deps.startRun.mockResolvedValue(err(new Error("boom")));
    deps.recordSkippedJob.mockRejectedValue(new Error("insert failed"));
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(deps.claimNextRun).toHaveBeenCalledWith(
      "routine-1",
      new Date("2026-06-10T09:00:00.000Z"),
      new Date("2026-06-10T09:05:00.000Z"),
    );
    expect(deps.onError).toHaveBeenCalledWith(expect.any(Error), "routine-1");
  });

  it("does not start when another tick has already claimed the occurrence", async () => {
    const deps = makeDeps([makeRoutine()]);
    deps.claimNextRun.mockResolvedValue(false);
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(deps.startRun).not.toHaveBeenCalled();
    expect(deps.updateRoutine).not.toHaveBeenCalled();
    expect(deps.recordSkippedJob).not.toHaveBeenCalled();
  });

  it("does not duplicate a launched job if the lastRunAt write fails later", async () => {
    const deps = makeDeps([makeRoutine()]);
    deps.claimNextRun.mockResolvedValueOnce(true).mockResolvedValue(false);
    deps.updateRoutine.mockRejectedValue(new Error("lastRunAt failed"));
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));
    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(deps.startRun).toHaveBeenCalledTimes(1);
    expect(deps.claimNextRun).toHaveBeenCalledTimes(2);
  });

  it("isolates a failing routine so the rest of the tick continues", async () => {
    const failing = makeRoutine({ id: "routine-a", pipelineId: "pipe-a" });
    const healthy = makeRoutine({ id: "routine-b", pipelineId: "pipe-b" });
    const deps = makeDeps([failing, healthy]);
    deps.updateRoutine.mockImplementation((id: string) =>
      id === "routine-a" ? Promise.reject(new Error("db down")) : Promise.resolve(undefined),
    );
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(deps.onError).toHaveBeenCalledWith(expect.any(Error), "routine-a");
    expect(deps.startRun).toHaveBeenCalledWith(expect.objectContaining({ pipelineId: "pipe-b" }));
    expect(deps.updateRoutine).toHaveBeenCalledWith("routine-b", expect.anything());
  });

  it("records runs missed beyond the grace window as skipped without backfilling", async () => {
    const deps = makeDeps([makeRoutine()]);
    const scheduler = createRoutineScheduler(deps);

    // Scheduled at 09:00, ticking well past the default grace window.
    const now = new Date(
      new Date("2026-06-10T09:00:00.000Z").getTime() + DEFAULT_GRACE_WINDOW_MS + 1000,
    );
    await scheduler.tick(now);

    expect(deps.startRun).not.toHaveBeenCalled();
    expect(deps.recordSkippedJob).toHaveBeenCalledWith({
      pipelineId: "pipe-1",
      routineId: "routine-1",
      routineName: "Morning run",
      reason:
        "Missed scheduled run at 2026-06-10T09:00:00.000Z and all subsequently missed windows while the scheduler was offline; missed runs are not backfilled",
    });
    expect(deps.claimNextRun).toHaveBeenCalledWith(
      "routine-1",
      new Date("2026-06-10T09:00:00.000Z"),
      expect.any(Date),
    );
    const updateOrder = deps.claimNextRun.mock.invocationCallOrder[0]!;
    const skipOrder = deps.recordSkippedJob.mock.invocationCallOrder[0]!;
    expect(updateOrder).toBeLessThan(skipOrder);
  });

  it("respects a custom grace window derived from the poll interval", async () => {
    const deps = makeDeps([makeRoutine()]);
    const scheduler = createRoutineScheduler(deps, { graceWindowMs: 10_000 });

    await scheduler.tick(new Date("2026-06-10T09:00:11.000Z"));

    expect(deps.startRun).not.toHaveBeenCalled();
    expect(deps.recordSkippedJob).toHaveBeenCalledTimes(1);
  });

  it("schedules routines with missing nextRunAt without running immediately", async () => {
    const deps = makeDeps([makeRoutine({ nextRunAt: null })]);
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(deps.startRun).not.toHaveBeenCalled();
    expect(deps.recordSkippedJob).not.toHaveBeenCalled();
    expect(deps.updateRoutine).toHaveBeenCalledWith("routine-1", {
      nextRunAt: new Date("2026-06-10T09:05:00.000Z"),
    });
  });

  it("does nothing for routines that are not yet due", async () => {
    const deps = makeDeps([makeRoutine({ nextRunAt: new Date("2026-06-10T10:00:00.000Z") })]);
    const scheduler = createRoutineScheduler(deps);

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(deps.startRun).not.toHaveBeenCalled();
    expect(deps.updateRoutine).not.toHaveBeenCalled();
    expect(deps.recordSkippedJob).not.toHaveBeenCalled();
  });
});
