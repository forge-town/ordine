import { ResultAsync } from "neverthrow";
import { toServiceError } from "../../../serviceErrors";
import { toMessage } from "../../helpers/agentThreadsToMessage";

import type { AgentThreadsServiceBindings } from "../../contracts";
export const createAgentThreadsGetMessagesMethod =
  (serviceBindings: Pick<AgentThreadsServiceBindings, "messagesDao">) => (threadId: string) =>
    ResultAsync.fromPromise(serviceBindings.messagesDao.findManyBySessionId(threadId), (error) =>
      toServiceError(error, "Get Agent thread messages"),
    ).map((messages) => messages.map(toMessage));
