import { ResultAsync } from "neverthrow";
import { toServiceError } from "../../../serviceErrors";
import { toThread } from "../../helpers/agentThreadsToThread";

import type { AgentThreadsServiceBindings } from "../../contracts";
export const createAgentThreadsGetAllMethod =
  (serviceBindings: Pick<AgentThreadsServiceBindings, "threadsDao">) => () =>
    ResultAsync.fromPromise(serviceBindings.threadsDao.findMany(), (error) =>
      toServiceError(error, "Get Agent threads"),
    ).map((threads) => threads.map(toThread));
