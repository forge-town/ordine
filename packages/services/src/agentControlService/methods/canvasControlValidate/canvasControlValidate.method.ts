import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "neverthrow";

import type { CanvasControlError, CanvasReadValue } from "../../helpers/canvasControl";
import { canvasError } from "../../helpers/canvasControlCanvasError";

import type { CanvasControlBindings } from "../../contracts";
export const createCanvasControlValidateMethod = (
  serviceBindings: Pick<CanvasControlBindings, "resolveSnapshot" | "validateSnapshot">,
) =>
  ({
    async validate({
      pipelineId,
      threadId,
      changeSetId,
      actionId = randomUUID(),
    }: {
      pipelineId: string;
      threadId: string;
      changeSetId?: string;
      actionId?: string;
    }): Promise<Result<CanvasReadValue, CanvasControlError>> {
      const resolved = await (0, serviceBindings.resolveSnapshot)({
        pipelineId,
        threadId,
        changeSetId,
      });
      if (!resolved) {
        return err(
          canvasError(actionId, "PIPELINE_NOT_FOUND", `Pipeline "${pipelineId}" was not found.`),
        );
      }
      if (changeSetId && !resolved.changeSet) {
        return err(
          canvasError(
            actionId,
            "CHANGE_SET_BINDING_MISMATCH",
            "The Change Set does not belong to this thread and Pipeline.",
            false,
            { field: "changeSetId" },
          ),
        );
      }
      const validation = await (0, serviceBindings.validateSnapshot)(resolved.snapshot, actionId);
      if (validation.isErr()) return err(validation.error);

      return ok({
        resources: [{ type: "pipeline", id: pipelineId, label: resolved.pipeline.name }],
        summary: `Canvas is valid at ${resolved.changeSet ? `Change Set revision ${resolved.changeSet.revision}` : `Pipeline version ${resolved.pipeline.version}`}.`,
        data: {
          valid: true,
          changeSetId: resolved.changeSet?.id ?? null,
          revision: resolved.changeSet?.revision ?? null,
          nodeCount: resolved.snapshot.nodes.length,
          edgeCount: resolved.snapshot.edges.length,
        },
      });
    },
  }).validate;
