import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createGetSessionByIdMethod =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      | "sessionsDao"
      | "activeActivities"
      | "planningRuns"
      | "messagesDao"
      | "attachmentsDao"
      | "contextArtifactsDao"
      | "proposalsDao"
    >,
  ) =>
  async (sessionId: string) => {
    const storedSession = await serviceBindings.sessionsDao.findById(sessionId);
    if (!storedSession) {
      return null;
    }

    const session =
      storedSession.status === "analyzing" &&
      !serviceBindings.activeActivities.has(sessionId) &&
      !serviceBindings.planningRuns.has(sessionId)
        ? {
            ...storedSession,
            ...(await serviceBindings.sessionsDao.update(sessionId, { status: "awaiting_user" })),
            status: "awaiting_user" as const,
          }
        : storedSession;

    const [messages, attachments, contextArtifacts, proposals] = await Promise.all([
      serviceBindings.messagesDao.findManyBySessionId(sessionId),
      serviceBindings.attachmentsDao.findManyBySessionId(sessionId),
      serviceBindings.contextArtifactsDao.findManyBySessionId(sessionId),
      serviceBindings.proposalsDao.findManyBySessionId(sessionId),
    ]);

    return {
      ...session,
      messages,
      attachments,
      contextArtifacts,
      proposals,
    };
  };
