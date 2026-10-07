import { ResultAsync } from "neverthrow";
import { getNextCronRunAt, toStringInputs } from "@repo/utils";
import type { RoutineSchedulerDeps, SchedulerRoutine } from "../../contracts";
import { describeError } from "../describeError";
export const createProcessRoutineHelper =
  (deps: RoutineSchedulerDeps, graceWindowMs: number) =>
  async (routine: SchedulerRoutine, now: Date) => {
    if (!routine.enabled) return;

    const scheduledAt = routine.nextRunAt;
    if (!scheduledAt) {
      const upcoming = getNextCronRunAt(routine.cronExpression, now);
      if (upcoming) {
        await deps.updateRoutine(routine.id, { nextRunAt: upcoming });
      }

      return;
    }

    if (scheduledAt.getTime() > now.getTime()) return;

    const upcoming = getNextCronRunAt(routine.cronExpression, now);
    const lateByMs = now.getTime() - scheduledAt.getTime();

    if (lateByMs > graceWindowMs) {
      const claimed = await deps.claimNextRun(routine.id, scheduledAt, upcoming);
      if (!claimed) return;

      await deps.recordSkippedJob({
        pipelineId: routine.pipelineId,
        routineId: routine.id,
        routineName: routine.name,
        reason: `Missed scheduled run at ${scheduledAt.toISOString()} and all subsequently missed windows while the scheduler was offline; missed runs are not backfilled`,
      });

      return;
    }

    const claimed = await deps.claimNextRun(routine.id, scheduledAt, upcoming);
    if (!claimed) return;

    // The startRun Result must be checked: a failed trigger (error Result
    // or rejected promise) becomes a skipped history entry instead of being
    // silently swallowed.
    const startResult = await ResultAsync.fromPromise(
      deps.startRun({
        inputs: toStringInputs(routine.inputConfig),
        jobId: `routine:${routine.id}:${scheduledAt.toISOString()}`,
        pipelineId: routine.pipelineId,
        triggeredBy: "routine",
      }),
      (error) => error,
    ).andThen((result) => result);

    if (startResult.isOk()) {
      await deps.updateRoutine(routine.id, { lastRunAt: now });
    } else {
      await deps.recordSkippedJob({
        pipelineId: routine.pipelineId,
        routineId: routine.id,
        routineName: routine.name,
        reason: `Failed to start scheduled run: ${describeError(startResult.error)}`,
      });
    }
  };
