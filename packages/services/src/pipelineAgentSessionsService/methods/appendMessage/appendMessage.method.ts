import type { PipelineAgentMessageKind, PipelineAgentMessageRole } from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createAppendMessageMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "messagesDao">) =>
  async (
    sessionId: string,
    input: {
      role: PipelineAgentMessageRole;
      kind: PipelineAgentMessageKind;
      content: string;
    },
  ) => {
    return serviceBindings.messagesDao.create({
      id: crypto.randomUUID(),
      sessionId,
      role: input.role,
      kind: input.kind,
      content: input.content,
    });
  };
