import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { NotFoundError, toServiceError } from "../../../serviceErrors";
import { toThread } from "../../helpers/agentThreadsToThread";

import type { AgentThreadsServiceBindings } from "../../contracts";
export const createAgentThreadsArchiveMethod =
  (serviceBindings: Pick<AgentThreadsServiceBindings, "threadsDao">) => (id: string) =>
    ResultAsync.fromPromise(
      serviceBindings.threadsDao.update(id, { threadStatus: "archived" }),
      (error) => toServiceError(error, "Archive Agent thread"),
    ).andThen((thread) =>
      thread ? okAsync(toThread(thread)) : errAsync(new NotFoundError("AgentThread", id)),
    );
