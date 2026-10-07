import { type SchedulerRoutine } from "../../contracts";
import { ok } from "neverthrow";
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
});
