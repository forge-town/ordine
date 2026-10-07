import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createSupersedeProposalMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "proposalsDao" | "sessionsDao">) =>
  async (sessionId: string, proposalId: string) => {
    const proposal = await serviceBindings.proposalsDao.findById(proposalId);
    if (!proposal || proposal.sessionId !== sessionId) {
      throw new Error(`Pipeline agent proposal not found for session ${sessionId}`);
    }

    await serviceBindings.proposalsDao.update(proposalId, { status: "superseded" });

    const session = await serviceBindings.sessionsDao.findById(sessionId);
    if (session?.latestProposalId === proposalId) {
      await serviceBindings.sessionsDao.update(sessionId, {
        latestProposalId: null,
        status: "awaiting_user",
      });
    }
  };
