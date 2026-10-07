import type {
  PipelineAgentMode,
  PipelineAgentProposal,
  PipelineAgentProposalStatus,
} from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createSaveProposalMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "proposalsDao" | "sessionsDao">) =>
  async (
    sessionId: string,
    input: {
      mode: PipelineAgentMode;
      proposal: PipelineAgentProposal;
      status?: PipelineAgentProposalStatus;
    },
  ) => {
    const proposal = await serviceBindings.proposalsDao.create({
      id: crypto.randomUUID(),
      sessionId,
      mode: input.mode,
      status: input.status ?? "proposal_ready",
      proposal: input.proposal,
      approvedAt: null,
    });

    await serviceBindings.sessionsDao.update(sessionId, {
      latestProposalId: proposal.id,
      status: "proposal_ready",
    });

    return proposal;
  };
