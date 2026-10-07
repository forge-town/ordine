import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createWaitForPlanningRunMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "planningCompletions">) =>
  async (runId: string): Promise<void> => {
    const completion = serviceBindings.planningCompletions.get(runId);
    if (completion) await completion;
  };
