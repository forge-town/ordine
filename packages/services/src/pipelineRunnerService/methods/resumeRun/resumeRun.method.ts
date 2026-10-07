import { ok, err, type Result } from "neverthrow";

import { pipelineRunControl } from "../../helpers/runControl";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createResumeRunMethod =
  (
    serviceBindings: Pick<
      PipelineRunnerServiceBindings,
      "guardJobStatus" | "persistStatus" | "InvalidJobStatusError"
    >,
  ) =>
  async (jobId: string): Promise<Result<{ jobId: string; resumed: boolean }, Error>> => {
    // "running" is also eligible: a checkpoint node suspends the run while
    // the job status stays "running". Resuming a non-suspended running job
    // is harmless — the status write is idempotent and no waiter is parked.
    const guard = await (0, serviceBindings.guardJobStatus)("resume", jobId, ["paused", "running"]);
    if (guard.isErr()) return err(guard.error);

    const write = await (0, serviceBindings.persistStatus)(jobId, ["paused", "running"], "running");
    if (write.isErr()) return err(write.error);
    if (!write.value) {
      return err(
        new serviceBindings.InvalidJobStatusError("resume", jobId, "changed concurrently", [
          "paused",
          "running",
        ]),
      );
    }

    return ok(pipelineRunControl.resume(jobId));
  };
