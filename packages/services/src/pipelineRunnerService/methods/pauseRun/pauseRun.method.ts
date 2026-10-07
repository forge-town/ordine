import { ok, err, type Result } from "neverthrow";

import { pipelineRunControl } from "../../helpers/runControl";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createPauseRunMethod =
  (
    serviceBindings: Pick<
      PipelineRunnerServiceBindings,
      "guardJobStatus" | "persistStatus" | "InvalidJobStatusError"
    >,
  ) =>
  async (jobId: string): Promise<Result<{ jobId: string; paused: boolean }, Error>> => {
    const guard = await (0, serviceBindings.guardJobStatus)("pause", jobId, ["running"]);
    if (guard.isErr()) return err(guard.error);

    const write = await (0, serviceBindings.persistStatus)(jobId, ["running"], "paused");
    if (write.isErr()) return err(write.error);
    if (!write.value) {
      return err(
        new serviceBindings.InvalidJobStatusError("pause", jobId, "changed concurrently", [
          "running",
        ]),
      );
    }

    return ok(pipelineRunControl.pause(jobId));
  };
