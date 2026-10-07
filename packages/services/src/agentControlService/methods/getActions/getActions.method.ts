import { toPublicAction } from "../../helpers/toPublicAction";

import type { AgentControlServiceBindings } from "../../contracts";
export const createGetActionsMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "actionsDao">,
) =>
  ({
    async getActions(threadId: string) {
      return (await serviceBindings.actionsDao.findManyByThreadId(threadId)).map(toPublicAction);
    },
  }).getActions;
