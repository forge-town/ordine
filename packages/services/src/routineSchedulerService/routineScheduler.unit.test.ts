import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import {
  createRoutineScheduler,
  DEFAULT_GRACE_WINDOW_MS,
  getNextCronRunAt,
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
  startRun: vi.fn().mockResolvedValue(ok({ jobId: "job-1" })),
  updateRoutine: vi.fn().mockResolvedValue(undefined),
  recordSkippedJob: vi.fn().mockResolvedValue(undefined),
});

describe("getNextCronRunAt", () => {
  it("computes the next run time for step expressions", () => {
    expect(
      getNextCronRunAt("*/15 * * * *", new Date("2026-06-10T09:07:20.000Z"))?.toISOString(),
    ).toBe("2026-06-10T09:15:00.000Z");
  });

  it("returns a strictly future minute even when called on an exact match", () => {
    expect(
      getNextCronRunAt("*/15 * * * *", new Date("2026-06-10T09:15:00.000Z"))?.toISOString(),
    ).toBe("2026-06-10T09:30:00.000Z");
  });

  // Weekday ranges must parse; the "Weekday 09:00" preset emits `0 9 * * 1-5`.
  // Assertions are timezone-independent: membership is checked via the same
  // local getters the parser uses.
  it("parses weekday ranges (0 9 * * 1-5)", () => {
    const next = getNextCronRunAt("0 9 * * 1-5", new Date("2026-06-12T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect(next!.getHours()).toBe(9);
    expect(next!.getMinutes()).toBe(0);
    expect([1, 2, 3, 4, 5]).toContain(next!.getDay());
  });

  it("parses weekday lists (0 9 * * 1,3,5)", () => {
    const next = getNextCronRunAt("0 9 * * 1,3,5", new Date("2026-06-10T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect([1, 3, 5]).toContain(next!.getDay());
  });

  it("parses range-with-step (0 0-10/2 * * *)", () => {
    const next = getNextCronRunAt("0 0-10/2 * * *", new Date("2026-06-10T03:30:00.000Z"));
    expect(next).not.toBeNull();
    expect(next!.getHours()).toBeLessThanOrEqual(10);
    expect(next!.getHours() % 2).toBe(0);
  });

  it("parses mixed comma segments (0-2,4 9 * * *)", () => {
    const next = getNextCronRunAt("0-2,4 9 * * *", new Date("2026-06-10T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect([0, 1, 2, 4]).toContain(next!.getMinutes());
    expect(next!.getHours()).toBe(9);
  });

  it("returns null for out-of-range or malformed fields", () => {
    expect(getNextCronRunAt("0 9 * * 6-7", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("0 9 * * 1-", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("0 99 * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("*/0 * * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("1,x * * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("* * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt(null, new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
  });
});

describe("routine scheduler tick", () => {
  it("starts due routines within the grace window as routine-triggered jobs", async () => {
    const deps = makeDeps([makeRoutine()]);
    const scheduler = createRoutineScheduler(deps);

    const now = new Date("2026-06-10T09:00:30.000Z");
    await scheduler.tick(now);

    expect(deps.startRun).toHaveBeenCalledWith({
      inputs: { prompt: "daily brief" },
      pipelineId: "pipe-1",
      triggeredBy: "routine",
    });
    expect(deps.recordSkippedJob).not.toHaveBeenCalled();
    expect(deps.updateRoutine).toHaveBeenCalledWith("routine-1", {
      lastRunAt: now,
      nextRunAt: new Date("2026-06-10T09:05:00.000Z"),
    });
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
    expect(deps.updateRoutine).toHaveBeenCalledWith("routine-1", {
      nextRunAt: new Date("2026-06-10T09:05:00.000Z"),
    });
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
    expect(deps.updateRoutine).toHaveBeenCalledWith("routine-1", {
      nextRunAt: new Date("2026-06-10T09:05:00.000Z"),
    });
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
        "Missed scheduled run at 2026-06-10T09:00:00.000Z while the scheduler was offline; missed runs are not backfilled",
    });
    expect(deps.updateRoutine).toHaveBeenCalledWith(
      "routine-1",
      expect.objectContaining({ nextRunAt: expect.any(Date) }),
    );
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
