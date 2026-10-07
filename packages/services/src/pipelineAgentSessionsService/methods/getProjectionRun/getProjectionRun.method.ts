import {
  PIPELINE_AGENT_PROJECTION_AGENT_ID,
  type PipelineAgentSessionsServiceBindings,
} from "../../contracts";

export const createGetProjectionRunMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "getAgentRunsService">) =>
  async (sessionId: string, afterRunId: string) => {
    const [sourceRun, projectionRun] = await Promise.all([
      (0, serviceBindings.getAgentRunsService)().getById(afterRunId),
      (0, serviceBindings.getAgentRunsService)().getLatestByOwner(
        "job-agent",
        `${sessionId}:${PIPELINE_AGENT_PROJECTION_AGENT_ID}`,
      ),
    ]);
    if (!sourceRun || !projectionRun || projectionRun.createdAt < sourceRun.createdAt) {
      return null;
    }

    return projectionRun;
  };
