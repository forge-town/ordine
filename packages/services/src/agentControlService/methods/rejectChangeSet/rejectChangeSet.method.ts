import type { AgentResourceRef } from "@repo/schemas";

import { toPublicChangeSet } from "../../helpers/toPublicChangeSet";

import type { AgentControlServiceBindings } from "../../contracts";
export const createRejectChangeSetMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "repository" | "emit">,
) =>
  ({
    async rejectChangeSet(
      changeSetId: string,
      reason: "rejected" | "cancelled" | "failed" = "rejected",
    ) {
      const rejected = await serviceBindings.repository.rejectChangeSet(changeSetId);
      if (rejected) {
        await (0, serviceBindings.emit)(rejected.runId, {
          type: "change_set_rolled_back",
          changeSetId,
          target: { type: rejected.targetType as AgentResourceRef["type"], id: rejected.targetId },
          reason,
        });
      }

      return rejected ? toPublicChangeSet(rejected) : null;
    },
  }).rejectChangeSet;
