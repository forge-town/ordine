import type { AgentResourceRef } from "@repo/schemas";

import { notifyCommittedChangeSet } from "../../helpers/notifyCommittedChangeSet/notifyCommittedChangeSet.helper";

import { toPublicChangeSet } from "../../helpers/toPublicChangeSet";

import type { AgentControlServiceBindings } from "../../contracts";
export const createApplyChangeSetMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "repository" | "options" | "emit">,
) =>
  ({
    async applyChangeSet(changeSetId: string, expectedVersion: number) {
      const applied = await serviceBindings.repository.applyChangeSet(changeSetId, expectedVersion);
      if (applied.type === "applied") {
        const notification = {
          type: "change_set_committed",
          changeSetId,
          target: {
            type: applied.changeSet.targetType as AgentResourceRef["type"],
            id: applied.changeSet.targetId,
          },
          previousVersion: applied.previousVersion,
          newVersion: applied.newVersion,
        } as const;
        await notifyCommittedChangeSet(
          serviceBindings.options.runEvents,
          applied.changeSet.runId,
          notification,
          () => (0, serviceBindings.emit)(applied.changeSet.runId, notification),
        );
      }

      return applied.type === "applied"
        ? { ...applied, changeSet: toPublicChangeSet(applied.changeSet) }
        : applied;
    },
  }).applyChangeSet;
