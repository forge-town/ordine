import type { RunPipelineAssemblyBindings } from "../../contracts";

import { createRunPipelineAggregateUsageTotalsSafelyHelper } from "../runPipelineAggregateUsageTotalsSafely";
import { createRunPipelineCreateNodeStatusWriterHelper } from "../runPipelineCreateNodeStatusWriter";
import { createRunPipelineRecordUsageOnFinalizedJobSafelyHelper } from "../runPipelineRecordUsageOnFinalizedJobSafely";
import { createRunPipelineFailJobSafelyHelper } from "../runPipelineFailJobSafely";

import { createRunPipelineRunMethod } from "../../methods/runPipelineRun";
const createRunPipelineAssembly = () => {
  const serviceBindings: RunPipelineAssemblyBindings = {
    get aggregateUsageTotalsSafely() {
      return aggregateUsageTotalsSafely;
    },
    get createNodeStatusWriter() {
      return createNodeStatusWriter;
    },
    get recordUsageOnFinalizedJobSafely() {
      return recordUsageOnFinalizedJobSafely;
    },
    get failJobSafely() {
      return failJobSafely;
    },
  };

  /**
   * Sum the persisted token usage of every agent raw export attached to the job.
   * Token counts are the only usage currency — there is no monetary cost tracking.
   * Never throws: an aggregation failure yields undefined so the terminal status
   * is still written (without totals) — a successful run must not turn failed
   * because usage bookkeeping broke.
   */
  const aggregateUsageTotalsSafely =
    createRunPipelineAggregateUsageTotalsSafelyHelper(serviceBindings);

  /**
   * Serialize node-status writes so concurrent engine callbacks cannot interleave
   * and persist a stale snapshot of the accumulated statuses.
   */
  const createNodeStatusWriter = createRunPipelineCreateNodeStatusWriterHelper(serviceBindings);

  /**
   * Top up usage totals on a job that was finalized out-of-band (e.g. cancelled
   * while its last node was executing), preserving whatever terminal status it
   * already has. Never throws.
   */
  const recordUsageOnFinalizedJobSafely =
    createRunPipelineRecordUsageOnFinalizedJobSafelyHelper(serviceBindings);

  /**
   * Mark a live job as failed with a compare-and-set transition. If the expiry
   * sweep wins the race, preserve the provider error without changing the
   * terminal `expired` status. Never leaks DAO or trace failures to the caller.
   */
  const failJobSafely = createRunPipelineFailJobSafelyHelper(serviceBindings);

  return {
    run: createRunPipelineRunMethod(serviceBindings),
  };
};

export const pipelineRunExecutor = createRunPipelineAssembly();
