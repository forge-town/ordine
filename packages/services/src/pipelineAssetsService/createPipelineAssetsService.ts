import { randomUUID } from "node:crypto";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { createPipelineAssetsDao, createPipelinesDao, type DbConnection } from "@repo/models";
import type { PipelineAssetInputSlot, PipelineNode } from "@repo/schemas";
import { ConflictError, NotFoundError, toServiceError } from "../serviceErrors";

const toInputSlots = (nodes: PipelineNode[]): PipelineAssetInputSlot[] =>
  nodes
    .filter((node) => node.metaType === "object")
    .map((node) => ({
      nodeId: node.id,
      label: node.data.label,
      acceptTypes: [node.data.nodeType],
    }));

export const createPipelineAssetsService = (db: DbConnection) => {
  const assetsDao = createPipelineAssetsDao(db);
  const pipelinesDao = createPipelinesDao(db);

  return {
    getAll: () =>
      ResultAsync.fromPromise(assetsDao.findMany(), (error) =>
        toServiceError(error, "Get pipeline assets"),
      ),
    getById: (id: string) =>
      ResultAsync.fromPromise(assetsDao.findById(id), (error) =>
        toServiceError(error, "Get pipeline asset"),
      ).andThen((asset) =>
        asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", id)),
      ),
    getByPipelineId: (pipelineId: string) =>
      ResultAsync.fromPromise(assetsDao.findManyByPipelineId(pipelineId), (error) =>
        toServiceError(error, "Get pipeline assets by pipeline"),
      ),
    /**
     * Usage counting is currently limited to source-pipeline liveness: 1 when
     * the source pipeline still exists, 0 otherwise. Counting references from
     * other pipelines requires an asset-reference field in the node schema —
     * implement real reference counting once that field lands.
     */
    getUsageCount: (id: string) =>
      ResultAsync.fromPromise(assetsDao.findById(id), (error) =>
        toServiceError(error, "Get pipeline asset usage target"),
      )
        .andThen((asset) =>
          asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", id)),
        )
        .andThen((asset) =>
          ResultAsync.fromPromise(pipelinesDao.findById(asset.pipelineId), (error) =>
            toServiceError(error, "Get pipeline asset usage"),
          ).map((pipeline) => ({
            assetId: id,
            count: pipeline ? 1 : 0,
          })),
        ),
    create: (data: Parameters<typeof assetsDao.create>[0]) =>
      ResultAsync.fromPromise(assetsDao.create(data), (error) =>
        toServiceError(error, "Create pipeline asset"),
      ),
    update: (id: string, patch: Parameters<typeof assetsDao.update>[1]) =>
      ResultAsync.fromPromise(assetsDao.update(id, patch), (error) =>
        toServiceError(error, "Update pipeline asset"),
      ).andThen((asset) =>
        asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", id)),
      ),
    incrementRunStats: (...args: Parameters<typeof assetsDao.incrementRunStats>) =>
      ResultAsync.fromPromise(assetsDao.incrementRunStats(...args), (error) =>
        toServiceError(error, "Increment pipeline asset run stats"),
      ).andThen((asset) =>
        asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", args[0])),
      ),
    distillFromPipeline: (pipelineId: string) =>
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
        }),
    delete: (id: string) =>
      ResultAsync.fromPromise(assetsDao.delete(id), (error) =>
        toServiceError(error, "Delete pipeline asset"),
      ),
  };
};
