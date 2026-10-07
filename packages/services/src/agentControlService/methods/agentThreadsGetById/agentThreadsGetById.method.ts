import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { NotFoundError, toServiceError } from "../../../serviceErrors";
import { toThread } from "../../helpers/agentThreadsToThread";

import type { AgentThreadsServiceBindings } from "../../contracts";
export const createAgentThreadsGetByIdMethod =
  (serviceBindings: Pick<AgentThreadsServiceBindings, "threadsDao">) => (id: string) =>
    ResultAsync.fromPromise(serviceBindings.threadsDao.findById(id), (error) =>
      toServiceError(error, "Get Agent thread"),
    ).andThen((thread) =>
      thread ? okAsync(toThread(thread)) : errAsync(new NotFoundError("AgentThread", id)),
    );
