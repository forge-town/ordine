import { randomUUID } from "node:crypto";

import { err, ok, type Result } from "neverthrow";

import type { CanvasControlError, CanvasReadValue } from "../../helpers/canvasControl";
import { canvasError } from "../../helpers/canvasControlCanvasError";
import { truncateNodeStrings } from "../../helpers/canvasControlTruncateNodeStrings";

import type { CanvasControlBindings } from "../../contracts";
export const createCanvasControlInspectMethod = (
  serviceBindings: Pick<CanvasControlBindings, "resolveSnapshot">,
) =>
  ({
    async inspect({
      pipelineId,
      threadId,
      nodeIds,
      cursor,
      limit,
    }: {
      pipelineId: string;
      threadId?: string | null;
      nodeIds?: string[];
      cursor?: string;
      limit: number;
    }): Promise<Result<CanvasReadValue, CanvasControlError>> {
      const actionId = randomUUID();
      const resolved = await (0, serviceBindings.resolveSnapshot)({ pipelineId, threadId });
      if (!resolved) {
        return err(
          canvasError(actionId, "PIPELINE_NOT_FOUND", `Pipeline "${pipelineId}" was not found.`),
        );
      }
      const offset = cursor ? Number.parseInt(cursor, 10) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0) {
        return err(
          canvasError(actionId, "INVALID_CURSOR", "cursor must be a non-negative integer", true, {
            field: "cursor",
          }),
        );
      }
      const selected = nodeIds?.length
        ? resolved.snapshot.nodes.filter((node) => nodeIds.includes(node.id))
        : resolved.snapshot.nodes.slice(offset, offset + limit);
      const selectedIds = new Set(selected.map((node) => node.id));
      const relatedEdges = resolved.snapshot.edges.filter(
        (edge) => selectedIds.has(edge.source) || selectedIds.has(edge.target),
      );
      const edges = relatedEdges.slice(0, 200);
      const nextOffset = offset + selected.length;
      const warnings =
        relatedEdges.length > edges.length
          ? [
              `${relatedEdges.length - edges.length} related edges were omitted; narrow nodeIds to inspect them.`,
            ]
          : [];

      return ok({
        resources: [{ type: "pipeline", id: pipelineId, label: resolved.pipeline.name }],
        summary: `Inspected ${selected.length} of ${resolved.snapshot.nodes.length} Canvas nodes and ${edges.length} related edges.`,
        data: {
          pipeline: {
            id: pipelineId,
            name: resolved.pipeline.name,
            version: resolved.pipeline.version,
          },
          changeSet: resolved.changeSet
            ? {
                id: resolved.changeSet.id,
                status: resolved.changeSet.status,
                baseVersion: resolved.changeSet.baseVersion,
                revision: resolved.changeSet.revision,
              }
            : null,
          nodes: truncateNodeStrings(selected),
          edges: truncateNodeStrings(edges),
          nextCursor:
            !nodeIds?.length && nextOffset < resolved.snapshot.nodes.length
              ? String(nextOffset)
              : null,
          totalNodes: resolved.snapshot.nodes.length,
          totalEdges: resolved.snapshot.edges.length,
        },
        warnings,
      });
    },
  }).inspect;
