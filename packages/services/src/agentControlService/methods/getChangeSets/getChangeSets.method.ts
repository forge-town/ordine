import { toPublicChangeSet } from "../../helpers/toPublicChangeSet";

import type { AgentControlServiceBindings } from "../../contracts";
export const createGetChangeSetsMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "changeSetsDao">,
) =>
  ({
    async getChangeSets(threadId: string) {
      return (await serviceBindings.changeSetsDao.findManyByThreadId(threadId)).map(
        toPublicChangeSet,
      );
    },
  }).getChangeSets;
