import { randomUUID } from "node:crypto";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { createPipelineAssetsDao, createPipelinesDao, type DbConnection } from "@repo/models";
import type { PipelineAssetInputSlot, PipelineNode } from "@repo/schemas";
import { NotFoundError, toServiceError } from "../serviceErrors";

const toInputSlots = (nodes: PipelineNode[]): PipelineAssetInputSlot[] =>
  nodes
    .filter((node) => node.metaType === "object")
    .map((node) => ({
      nodeId: node.id,
      label: node.data.label,
      acceptTypes: [node.data.nodeType],
    }));

const nodeReferencesAsset = (node: PipelineNode, assetId: string): boolean => {
  const data = node.data as Record<string, unknown>;

  return (
    data.assetId === assetId || data.pipelineAssetId === assetId || data.sourceAssetId === assetId
  );
};

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
    getUsageCount: (id: string) =>
      ResultAsync.fromPromise(assetsDao.findById(id), (error) =>
        toServiceError(error, "Get pipeline asset usage target"),
      )
        .andThen((asset) =>
          asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", id)),
        )
        .andThen((asset) =>
          ResultAsync.fromPromise(pipelinesDao.findMany(), (error) =>
            toServiceError(error, "Get pipeline asset usage"),
          ).map((pipelines) => ({
            assetId: id,
            count: pipelines.filter(
              (pipeline) =>
                pipeline.id === asset.pipelineId ||
                pipeline.nodes.some((node) => nodeReferencesAsset(node, id)),
            ).length,
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
        .andThen((pipeline) =>
          ResultAsync.fromPromise(assetsDao.findManyByPipelineId(pipelineId), (error) =>
            toServiceError(error, "Get existing pipeline asset"),
          ).andThen((existingAssets) => {
            const inputSlots = toInputSlots(pipeline.nodes);
            const snapshot = {
              name: pipeline.name,
              description: pipeline.description,
              snapshotNodes: pipeline.nodes,
              snapshotEdges: pipeline.edges,
              inputSlots,
              tags: pipeline.tags,
            };
            const existing = existingAssets[0];

            if (existing) {
              return ResultAsync.fromPromise(assetsDao.update(existing.id, snapshot), (error) =>
                toServiceError(error, "Update distilled pipeline asset"),
              ).andThen((asset) =>
                asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", existing.id)),
              );
            }

            return ResultAsync.fromPromise(
              assetsDao.create({
                id: randomUUID(),
                pipelineId,
                ...snapshot,
              }),
              (error) => toServiceError(error, "Create distilled pipeline asset"),
            );
          }),
        ),
    delete: (id: string) =>
      ResultAsync.fromPromise(assetsDao.delete(id), (error) =>
        toServiceError(error, "Delete pipeline asset"),
      ),
  };
};
