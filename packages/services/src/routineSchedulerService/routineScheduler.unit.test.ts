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

  // N21-02: 区间/列表支持（内置「Weekday 09:00」预设生成 `0 9 * * 1-5`，旧实现返回 null 静默失效）。
  // TZ 无关断言：按 Date 的本地 getDay/getHours 判定成员归属，与解析器内部一致。
  it("parses weekday ranges (0 9 * * 1-5) instead of silently failing", () => {
    const next = getNextCronRunAt("0 9 * * 1-5", new Date("2026-06-12T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect(next!.getHours()).toBe(9);
    expect(next!.getMinutes()).toBe(0);
    expect([1, 2, 3, 4, 5]).toContain(next!.getDay()); // 永不落到周六/周日
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

  it("returns null for out-of-range / malformed fields", () => {
    expect(getNextCronRunAt("0 9 * * 6-7", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("0 9 * * 1-", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("0 99 * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
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
