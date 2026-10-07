import type { PipelineGraphSnapshot } from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";

import type { CanvasControlError } from "../canvasControl";
import { canvasError } from "../canvasControlCanvasError";

import type { CanvasControlBindings } from "../../contracts";
export const createCanvasControlValidateOperationReferencesHelper =
  (serviceBindings: Pick<CanvasControlBindings, "operationsDao">) =>
  async (
    snapshot: PipelineGraphSnapshot,
    actionId: string,
  ): Promise<Result<void, CanvasControlError>> => {
    const operationNodes = snapshot.nodes.flatMap((node) =>
      node.data.nodeType === "operation" ? [{ node, operationId: node.data.operationId }] : [],
    );
    const operations = await Promise.all(
      operationNodes.map(({ operationId }) => serviceBindings.operationsDao.findById(operationId)),
    );
    const missingIndex = operations.findIndex((operation) => !operation);
    if (missingIndex === -1) return ok(undefined);
    const missing = operationNodes[missingIndex]!;

    return err(
      canvasError(
        actionId,
        "OPERATION_NOT_FOUND",
        `Operation "${missing.operationId}" referenced by node "${missing.node.id}" was not found.`,
        true,
        { nodeId: missing.node.id, field: "node.data.operationId" },
      ),
    );
  };
