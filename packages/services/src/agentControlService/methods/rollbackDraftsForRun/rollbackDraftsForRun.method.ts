import type { AgentResourceRef } from "@repo/schemas";

import type { AgentControlServiceBindings } from "../../contracts";
export const createRollbackDraftsForRunMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "actionsDao" | "repository" | "emit">,
) =>
  ({
    async rollbackDraftsForRun(runId: string, reason: "cancelled" | "failed") {
      const actions = await serviceBindings.actionsDao.findManyByRunId(runId);
      const changeSetIds = [
        ...new Set(
          actions
            .filter((action) => action.runId === runId)
            .map((action) => action.changeSetId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const rolledBack = [];
      for (const changeSetId of changeSetIds) {
        const rejected = await serviceBindings.repository.rejectChangeSet(changeSetId);
        if (rejected) {
          rolledBack.push(rejected);
          await (0, serviceBindings.emit)(rejected.runId, {
            type: "change_set_rolled_back",
            changeSetId,
            target: {
              type: rejected.targetType as AgentResourceRef["type"],
              id: rejected.targetId,
            },
            reason,
          });
        }
      }

      return rolledBack;
    },
  }).rollbackDraftsForRun;
