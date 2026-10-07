import { createExecutionProcessLimiter } from "../processLimiter";

import { createExecutionActors } from "../../../executionActors";
import { executionServiceResult } from "../serviceResult";
type Dependencies = JobRunnerDependencies;

export type ExecutionJobRunner = ReturnType<typeof createExecutionJobRunner>;
import type { JobRunnerDependencies, ExecutionJobRunnerBindings } from "../../contracts";

import { createJobRunnerRunMethod } from "../../methods/jobRunnerRun";
export const createExecutionJobRunner = (deps: Dependencies) => {
  const serviceBindings: ExecutionJobRunnerBindings = {
    get deps(): ExecutionJobRunnerBindings["deps"] {
      return deps;
    },
    get processes(): ExecutionJobRunnerBindings["processes"] {
      return processes;
    },
    get leaseMs(): ExecutionJobRunnerBindings["leaseMs"] {
      return leaseMs;
    },
    get heartbeatMs(): ExecutionJobRunnerBindings["heartbeatMs"] {
      return heartbeatMs;
    },
    get actors(): ExecutionJobRunnerBindings["actors"] {
      return actors;
    },
  };

  const processes = createExecutionProcessLimiter(deps.processLimits);
  const leaseMs = deps.leaseMs ?? 30_000;
  const heartbeatMs = deps.heartbeatMs ?? 1000;
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs < 50 || heartbeatMs * 3 >= leaseMs)
    throw new Error("Heartbeat must leave a safe lease margin");
  const actors = createExecutionActors({
    artifactStore: deps.artifactStore,
    limits: { maxDurationMs: 86_400_000 },
    onProcessResult: async (context, report) =>
      executionServiceResult(async () => {
        await deps.jobs.appendEvent(context.artifactContext.lease, {
          type: "process_result",
          nodeId: context.node.id,
          attemptId: context.attemptId,
          payload: report,
        });
      }),
  });

  return {
    run: createJobRunnerRunMethod(serviceBindings),
  };
};
