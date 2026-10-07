import { randomUUID } from "node:crypto";

import { toPublicChangeSet } from "../../helpers/toPublicChangeSet";

import type { AgentControlServiceBindings } from "../../contracts";
export const createRedoChangeSetMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "repository" | "emit">,
) =>
  ({
    async redoChangeSet(sourceChangeSetId: string, expectedVersion: number, runId?: string | null) {
      const result = await serviceBindings.repository.compensateChangeSet({
        sourceChangeSetId,
        expectedVersion,
        kind: "redo",
        id: randomUUID(),
        runId,
      });
      if (result.type === "applied") {
        await (0, serviceBindings.emit)(result.changeSet.runId, {
          type: "change_set_committed",
          changeSetId: result.changeSet.id,
          target: { type: "pipeline", id: result.changeSet.targetId },
          previousVersion: result.previousVersion,
          newVersion: result.newVersion,
        });
      }

      return result.type === "applied"
        ? { ...result, changeSet: toPublicChangeSet(result.changeSet) }
        : result;
    },
  }).redoChangeSet;
