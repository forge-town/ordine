import { toPublicApproval } from "../../helpers/toPublicApproval";

import type { AgentControlServiceBindings } from "../../contracts";
export const createGetApprovalsMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "approvalsDao">,
) =>
  ({
    async getApprovals(threadId: string) {
      await serviceBindings.approvalsDao.expirePending(new Date());

      return (await serviceBindings.approvalsDao.findManyByThreadId(threadId)).map(
        toPublicApproval,
      );
    },
  }).getApprovals;
