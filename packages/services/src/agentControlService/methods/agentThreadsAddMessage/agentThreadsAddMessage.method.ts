import { randomUUID } from "node:crypto";

import type { AgentContextEnvelope } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { toServiceError } from "../../../serviceErrors";
import { toMessage } from "../../helpers/agentThreadsToMessage";

import type { AgentThreadsServiceBindings } from "../../contracts";
export const createAgentThreadsAddMessageMethod =
  (serviceBindings: Pick<AgentThreadsServiceBindings, "messagesDao">) =>
  ({
    threadId,
    role,
    content,
    context = null,
    runId = null,
    kind = "text",
  }: {
    threadId: string;
    role: "user" | "assistant" | "system";
    content: string;
    context?: AgentContextEnvelope | null;
    runId?: string | null;
    kind?:
      | "text"
      | "question"
      | "answer"
      | "proposal_summary"
      | "generation_result"
      | "phase"
      | "progress";
  }) =>
    ResultAsync.fromPromise(
      serviceBindings.messagesDao.create({
        id: randomUUID(),
        sessionId: threadId,
        role,
        kind,
        content,
        context,
        runId,
      }),
      (error) => toServiceError(error, "Add Agent thread message"),
    ).map(toMessage);
