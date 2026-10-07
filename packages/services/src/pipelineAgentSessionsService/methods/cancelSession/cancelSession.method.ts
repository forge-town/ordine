import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createCancelSessionMethod =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      | "sessionsDao"
      | "activeActivities"
      | "planningRuns"
      | "getAgentRunsService"
      | "finishActivity"
      | "proposalsDao"
    >,
  ) =>
  async (sessionId: string) => {
    const session = await serviceBindings.sessionsDao.findById(sessionId);
    if (!session) {
      throw new Error(`Pipeline agent session not found: ${sessionId}`);
    }

    const activity = serviceBindings.activeActivities.get(sessionId);
    activity?.controller.abort();
    const planningRun = serviceBindings.planningRuns.get(sessionId);
    if (planningRun) {
      await (0, serviceBindings.getAgentRunsService)().cancel(planningRun.runId);
      serviceBindings.planningRuns.delete(sessionId);
      if (activity) (0, serviceBindings.finishActivity)(sessionId, activity);
      await serviceBindings.sessionsDao.update(sessionId, { status: "awaiting_user" });

      return { status: "awaiting_user" as const };
    }

    if (activity?.kind === "planning" || session.status === "analyzing") {
      if (activity) (0, serviceBindings.finishActivity)(sessionId, activity);
      await serviceBindings.sessionsDao.update(sessionId, { status: "awaiting_user" });

      return { status: "awaiting_user" as const };
    }

    if (
      activity?.kind === "generating" ||
      session.status === "approved" ||
      session.status === "generating"
    ) {
      const proposalId = session.approvedProposalId ?? session.latestProposalId;
      if (proposalId) {
        await serviceBindings.proposalsDao.update(proposalId, {
          status: "proposal_ready",
          approvedAt: null,
        });
      }
      await serviceBindings.sessionsDao.update(sessionId, {
        status: "proposal_ready",
        latestProposalId: proposalId ?? session.latestProposalId,
        approvedProposalId: null,
        createdPipelineId: null,
      });

      return { status: "proposal_ready" as const };
    }

    return { status: session.status };
  };
