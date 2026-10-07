import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { NotFoundError, toServiceError } from "../../../serviceErrors";
import { toThread } from "../../helpers/agentThreadsToThread";

import type { AgentThreadsServiceBindings } from "../../contracts";
export const createAgentThreadsRenameMethod =
  (serviceBindings: Pick<AgentThreadsServiceBindings, "threadsDao">) =>
  (id: string, title: string) =>
    ResultAsync.fromPromise(serviceBindings.threadsDao.update(id, { title }), (error) =>
      toServiceError(error, "Rename Agent thread"),
    ).andThen((thread) =>
      thread ? okAsync(toThread(thread)) : errAsync(new NotFoundError("AgentThread", id)),
    );
