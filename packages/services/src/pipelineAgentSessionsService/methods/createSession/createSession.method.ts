import type {
  PipelineAgentEntrypoint,
  PipelineAgentMode,
  PipelineAgentSessionStatus,
  PipelineGraphSnapshot,
} from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createCreateSessionMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "sessionsDao">) =>
  async (input: {
    entrypoint: PipelineAgentEntrypoint;
    mode: PipelineAgentMode;
    pipelineId?: string | null;
    snapshot?: PipelineGraphSnapshot | null;
  }) => {
    return serviceBindings.sessionsDao.create({
      id: crypto.randomUUID(),
      entrypoint: input.entrypoint,
      mode: input.mode,
      status: "draft" satisfies PipelineAgentSessionStatus,
      pipelineId: input.pipelineId ?? null,
      snapshot: input.snapshot ?? null,
      latestProposalId: null,
      approvedProposalId: null,
      createdPipelineId: null,
    });
  };
