import { ok, err, type Result } from "neverthrow";

import { pipelineRunControl } from "../../helpers/runControl";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createCancelRunMethod =
  (
    serviceBindings: Pick<
      PipelineRunnerServiceBindings,
      "guardJobStatus" | "persistStatus" | "InvalidJobStatusError"
    >,
  ) =>
  async (jobId: string): Promise<Result<{ jobId: string; cancelled: boolean }, Error>> => {
    // "queued" is eligible too: it allows cancelling a run right after start
    // and is the only way to clean up a job stuck in queued.
    const guard = await (0, serviceBindings.guardJobStatus)("cancel", jobId, [
      "queued",
      "running",
      "paused",
    ]);
    if (guard.isErr()) return err(guard.error);

    // Persist the cancelled status before releasing any waiter, so the
    // executor's terminal-status guard reliably sees "cancelled".
    const write = await (0, serviceBindings.persistStatus)(
      jobId,
      ["queued", "running", "paused"],
      "cancelled",
      {
        finishedAt: new Date(),
      },
    );
    if (write.isErr()) return err(write.error);
    if (!write.value) {
      return err(
        new serviceBindings.InvalidJobStatusError("cancel", jobId, "changed concurrently", [
          "queued",
          "running",
          "paused",
        ]),
      );
    }

    return ok(pipelineRunControl.cancel(jobId));
  };
