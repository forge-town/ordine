import { applyPipelineActions } from "@repo/pipeline-engine";
import { PipelineGraphSnapshotSchema, type PipelineGraphSnapshot } from "@repo/schemas";
import { err, type Result } from "neverthrow";

import type { CanvasControlError } from "../canvasControl";
import { canvasError } from "../canvasControlCanvasError";
import { fullGraphActions } from "../canvasControlFullGraphActions";

import type { CanvasControlBindings } from "../../contracts";
export const createCanvasControlValidateSnapshotHelper =
  (serviceBindings: Pick<CanvasControlBindings, "validateOperationReferences">) =>
  async (
    snapshot: PipelineGraphSnapshot,
    actionId: string,
  ): Promise<Result<void, CanvasControlError>> => {
    const parsed = PipelineGraphSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];

      return err(
        canvasError(
          actionId,
          "INVALID_CANVAS",
          issue?.message ?? "The Canvas graph is invalid.",
          true,
          { field: issue?.path.join(".") || undefined },
        ),
      );
    }
    const validated = applyPipelineActions({ nodes: [], edges: [] }, fullGraphActions(parsed.data));
    if (validated.isErr()) {
      const issue = validated.error[0]!;

      return err(canvasError(actionId, issue.code, issue.message, true));
    }

    return (0, serviceBindings.validateOperationReferences)(parsed.data, actionId);
  };
