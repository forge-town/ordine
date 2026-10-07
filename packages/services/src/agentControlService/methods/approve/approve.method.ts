import { toPublicApproval } from "../../helpers/toPublicApproval";

import type { AgentControlServiceBindings } from "../../contracts";
export const createApproveMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "approvalsDao">,
) =>
  ({
    async approve(approvalId: string) {
      await serviceBindings.approvalsDao.expirePending(new Date());

      const approval = await serviceBindings.approvalsDao.approve(approvalId, new Date());

      return approval ? toPublicApproval(approval) : null;
    },
  }).approve;
