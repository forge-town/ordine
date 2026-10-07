import type {
  PipelineAgentActivityKind,
  PipelineAgentActivity,
  PipelineAgentSessionsServiceBindings,
} from "../../contracts";

export const createBeginActivityHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "activeActivities">) =>
  (sessionId: string, kind: PipelineAgentActivityKind) => {
    serviceBindings.activeActivities.get(sessionId)?.controller.abort();
    const activity = { controller: new AbortController(), kind } satisfies PipelineAgentActivity;
    serviceBindings.activeActivities.set(sessionId, activity);

    return activity;
  };
