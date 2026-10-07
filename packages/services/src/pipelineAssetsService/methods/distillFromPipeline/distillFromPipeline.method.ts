import { toInputSlots } from "../../helpers/toInputSlots";
import { randomUUID } from "node:crypto";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createPipelineAssetsDao, createPipelinesDao } from "@repo/models";

import { ConflictError, NotFoundError, toServiceError } from "../../../serviceErrors";

export const createDistillFromPipelineMethod =
  (
    assetsDao: ReturnType<typeof createPipelineAssetsDao>,
    pipelinesDao: ReturnType<typeof createPipelinesDao>,
  ) =>
  (pipelineId: string) =>
    ResultAsync.fromPromise(pipelinesDao.findById(pipelineId), (error) =>
      toServiceError(error, "Get pipeline for asset distillation"),
    )
      .andThen((pipeline) =>
        pipeline ? okAsync(pipeline) : errAsync(new NotFoundError("Pipeline", pipelineId)),
      )
      .andThen((pipeline) => {
        // An empty pipeline cannot be distilled: PipelineAssetSchema requires
        // at least one snapshot node, and an empty snapshot would be useless.
        if (pipeline.nodes.length === 0) {
          return errAsync(new ConflictError(`Pipeline "${pipelineId}" has no nodes to distill`));
        }

        return ResultAsync.fromPromise(assetsDao.findManyByPipelineId(pipelineId), (error) =>
          toServiceError(error, "Get existing pipeline asset"),
        ).andThen((existingAssets) => {
          const inputSlots = toInputSlots(pipeline.nodes);
          // findManyByPipelineId orders by updatedAt desc, so [0] is
          // deterministic: the most recently updated asset gets refreshed.
          const existing = existingAssets[0];

          if (existing) {
            // Conservative re-distillation: only the snapshot (nodes/edges/
            // input slots) is refreshed. name/description/tags may have been
            // edited by the user and run statistics keep accumulating — none
            // of those are overwritten here.
            return ResultAsync.fromPromise(
              assetsDao.update(existing.id, {
                snapshotNodes: pipeline.nodes,
                snapshotEdges: pipeline.edges,
                inputSlots,
              }),
              (error) => toServiceError(error, "Update distilled pipeline asset"),
            ).andThen((asset) =>
              asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", existing.id)),
            );
          }

          return ResultAsync.fromPromise(
            assetsDao.create({
              id: randomUUID(),
              pipelineId,
              name: pipeline.name,
              description: pipeline.description,
              snapshotNodes: pipeline.nodes,
              snapshotEdges: pipeline.edges,
              inputSlots,
              // PipelineAssetSchema requires a non-empty tags list; fall back
              // to the pipeline name when the pipeline has no tags. Default
              // policy to satisfy the schema — product may adjust it later.
              tags: pipeline.tags.length > 0 ? pipeline.tags : [pipeline.name],
            }),
            (error) => toServiceError(error, "Create distilled pipeline asset"),
          );
        });
      });
