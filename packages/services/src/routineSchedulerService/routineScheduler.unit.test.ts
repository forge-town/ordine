import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Routine } from "@repo/schemas";
import { createRoutineScheduler, getNextCronRunAt } from "./routineScheduler";

const makeRoutine = (overrides: Partial<Routine> = {}): Routine => ({
  id: "routine-1",
  pipelineId: "pipe-1",
  name: "Morning run",
  triggerType: "cron",
  cronExpression: "*/5 * * * *",
  eventType: null,
  eventConfig: null,
  inputConfig: { prompt: "daily brief", ignored: 42 },
  enabled: true,
  lastRunAt: null,
  nextRunAt: new Date("2026-06-10T09:00:00.000Z"),
  createdAt: new Date("2026-06-10T08:00:00.000Z"),
  updatedAt: new Date("2026-06-10T08:00:00.000Z"),
  ...overrides,
});

describe("routine scheduler", () => {
  it("computes the next cron run time for step expressions", () => {
    expect(
      getNextCronRunAt("*/15 * * * *", new Date("2026-06-10T09:07:20.000Z"))?.toISOString(),
    ).toBe("2026-06-10T09:15:00.000Z");
  });

  it("starts due cron routines as routine-triggered jobs", async () => {
    const startRun = vi.fn().mockResolvedValue(ok({ jobId: "job-1" }));
    const updateRoutine = vi.fn().mockResolvedValue(undefined);
    const scheduler = createRoutineScheduler({
      getEnabledRoutines: vi.fn().mockResolvedValue([makeRoutine()]),
      startRun,
      updateRoutine,
    });

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(startRun).toHaveBeenCalledWith({
      inputs: { prompt: "daily brief" },
      pipelineId: "pipe-1",
      triggeredBy: "routine",
    });
    expect(updateRoutine).toHaveBeenCalledWith(
      "routine-1",
      expect.objectContaining({
        lastRunAt: new Date("2026-06-10T09:00:30.000Z"),
        nextRunAt: new Date("2026-06-10T09:05:00.000Z"),
      }),
    );
  });

  it("schedules routines with missing nextRunAt without running immediately", async () => {
    const startRun = vi.fn().mockResolvedValue(ok({ jobId: "job-1" }));
    const updateRoutine = vi.fn().mockResolvedValue(undefined);
    const scheduler = createRoutineScheduler({
      getEnabledRoutines: vi.fn().mockResolvedValue([makeRoutine({ nextRunAt: null })]),
      startRun,
      updateRoutine,
    });

    await scheduler.tick(new Date("2026-06-10T09:00:30.000Z"));

    expect(startRun).not.toHaveBeenCalled();
    expect(updateRoutine).toHaveBeenCalledWith("routine-1", {
      nextRunAt: new Date("2026-06-10T09:05:00.000Z"),
    });
  });
});
