import { createPipelineAgentMessagesDao, createPipelineAgentSessionsDao } from "@repo/models";

import type { PipelineAgentActivity, PipelineAgentSessionsServiceBindings } from "../../contracts";

export const createSavePlanningQuestionHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "db" | "assertActivityActive">) =>
  async (sessionId: string, question: string, activity: PipelineAgentActivity) => {
    await serviceBindings.db.transaction(async (tx) => {
      (0, serviceBindings.assertActivityActive)(sessionId, activity);
      const transactionalMessagesDao = createPipelineAgentMessagesDao(tx);
      const transactionalSessionsDao = createPipelineAgentSessionsDao(tx);
      await transactionalMessagesDao.create({
        id: crypto.randomUUID(),
        sessionId,
        role: "assistant",
        kind: "question",
        content: question,
      });
      (0, serviceBindings.assertActivityActive)(sessionId, activity);
      await transactionalSessionsDao.update(sessionId, { status: "awaiting_user" });
      (0, serviceBindings.assertActivityActive)(sessionId, activity);
    });
  };
