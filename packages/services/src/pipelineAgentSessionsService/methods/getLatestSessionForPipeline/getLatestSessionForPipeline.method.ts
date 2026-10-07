import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createGetLatestSessionForPipelineMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "sessionsDao">) =>
  async (pipelineId: string) =>
    serviceBindings.sessionsDao.findLatestEditByPipelineId(pipelineId);
