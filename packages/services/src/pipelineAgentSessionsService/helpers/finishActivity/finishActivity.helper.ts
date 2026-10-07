import type { PipelineAgentActivity, PipelineAgentSessionsServiceBindings } from "../../contracts";

export const createFinishActivityHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "activeActivities">) =>
  (sessionId: string, activity: PipelineAgentActivity) => {
    if (serviceBindings.activeActivities.get(sessionId)?.controller === activity.controller) {
      serviceBindings.activeActivities.delete(sessionId);
    }
  };
