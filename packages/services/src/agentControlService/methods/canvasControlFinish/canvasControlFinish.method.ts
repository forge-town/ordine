import { err, ok, type Result } from "neverthrow";

import type { CanvasControlError, CanvasReadValue } from "../../helpers/canvasControl";
import { canvasError } from "../../helpers/canvasControlCanvasError";

import type { CanvasControlBindings } from "../../contracts";
export const createCanvasControlFinishMethod = (
  serviceBindings: Pick<
    CanvasControlBindings,
    "resolveSnapshot" | "actionsDao" | "changeSetsDao" | "validateSnapshot"
  >,
) =>
  ({
    async finish({
      pipelineId,
      threadId,
      changeSetId,
      expectedVersion,
      actionId,
    }: {
      pipelineId: string;
      threadId: string;
      changeSetId?: string;
      expectedVersion: number;
      actionId: string;
    }): Promise<Result<CanvasReadValue, CanvasControlError>> {
      const resolved = await (0, serviceBindings.resolveSnapshot)({
        pipelineId,
        threadId,
        changeSetId,
      });
      if (!resolved || !resolved.changeSet) {
        return err(
          canvasError(
            actionId,
            "CHANGE_SET_NOT_FOUND",
            "No active Canvas Change Set was found.",
            true,
          ),
        );
      }
      const changeSet = resolved.changeSet;
      if (changeSet.status === "ready") {
        const actionCount = (
          await serviceBindings.actionsDao.findManyByChangeSetId(changeSet.id)
        ).filter((action) => action.status === "succeeded").length;

        return ok({
          resources: [{ type: "pipeline", id: pipelineId, label: resolved.pipeline.name }],
          summary: `Change Set ${changeSet.id} is already ready for Apply.`,
          data: { changeSetId: changeSet.id, baseVersion: changeSet.baseVersion, actionCount },
        });
      }
      if (changeSet.status !== "drafting") {
        return err(
          canvasError(
            actionId,
            "CHANGE_SET_NOT_DRAFTING",
            `Change Set ${changeSet.id} is ${changeSet.status}.`,
            true,
          ),
        );
      }
      if (
        expectedVersion !== changeSet.baseVersion ||
        resolved.pipeline.version !== changeSet.baseVersion
      ) {
        await serviceBindings.changeSetsDao.transition(changeSet.id, ["drafting"], {
          status: "conflicted",
        });

        return err(
          canvasError(
            actionId,
            "VERSION_CONFLICT",
            `Pipeline version is ${resolved.pipeline.version}; Change Set base version is ${changeSet.baseVersion}. The draft was preserved.`,
            true,
            { field: "expectedVersion" },
          ),
        );
      }
      const validation = await (0, serviceBindings.validateSnapshot)(resolved.snapshot, actionId);
      if (validation.isErr()) return err(validation.error);
      const ready = await serviceBindings.changeSetsDao.transition(changeSet.id, ["drafting"], {
        status: "ready",
      });
      if (!ready) {
        return err(
          canvasError(
            actionId,
            "CHANGE_SET_STATE_CONFLICT",
            "The Change Set state changed; inspect and retry.",
            true,
          ),
        );
      }
      const actionCount = (
        await serviceBindings.actionsDao.findManyByChangeSetId(changeSet.id)
      ).filter((action) => action.status === "succeeded").length;

      return ok({
        resources: [{ type: "pipeline", id: pipelineId, label: resolved.pipeline.name }],
        summary: `Change Set ${changeSet.id} is valid and ready for Apply. Stop editing and ask the user to click Apply and save. Do not prepare execution until the user has applied the Change Set.`,
        data: { changeSetId: changeSet.id, baseVersion: changeSet.baseVersion, actionCount },
      });
    },
  }).finish;
