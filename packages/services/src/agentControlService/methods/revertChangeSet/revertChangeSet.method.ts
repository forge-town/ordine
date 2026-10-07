import { randomUUID } from "node:crypto";

import { toPublicChangeSet } from "../../helpers/toPublicChangeSet";

import type { AgentControlServiceBindings } from "../../contracts";
export const createRevertChangeSetMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "repository" | "emit">,
) =>
  ({
    async revertChangeSet(
      sourceChangeSetId: string,
      expectedVersion: number,
      runId?: string | null,
    ) {
      const result = await serviceBindings.repository.compensateChangeSet({
        sourceChangeSetId,
        expectedVersion,
        kind: "revert",
        id: randomUUID(),
        runId,
      });
      if (result.type === "applied") {
        await (0, serviceBindings.emit)(result.changeSet.runId, {
          type: "change_set_rolled_back",
          changeSetId: result.changeSet.id,
          target: { type: "pipeline", id: result.changeSet.targetId },
          reason: "reverted",
        });
      }

      return result.type === "applied"
        ? { ...result, changeSet: toPublicChangeSet(result.changeSet) }
        : result;
    },
  }).revertChangeSet;
