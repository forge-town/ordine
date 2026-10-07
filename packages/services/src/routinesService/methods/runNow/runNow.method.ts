import { err, type Result } from "neverthrow";
import type { createRoutinesDao } from "@repo/models";

import { toStringInputs } from "@repo/utils";
import type { RoutineStartRun } from "../../../routineSchedulerService/contracts";
import { NotFoundError } from "../../../serviceErrors";

export const createRunNowMethod =
  (
    dao: ReturnType<typeof createRoutinesDao>,
    deps: {
      startRun: RoutineStartRun;
    },
  ) =>
  async (id: string): Promise<Result<{ jobId: string }, Error>> => {
    const routine = await dao.findById(id);
    if (!routine) return err(new NotFoundError("Routine", id));

    const result = await deps.startRun({
      inputs: toStringInputs(routine.inputConfig),
      pipelineId: routine.pipelineId,
      triggeredBy: "routine",
    });
    if (result.isOk()) {
      // Run now does not touch the cron schedule; it only marks the routine
      // as having run.
      await dao.update(id, { lastRunAt: new Date() });
    }

    return result;
  };
