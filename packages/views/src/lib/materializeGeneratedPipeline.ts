import type { DataProvider } from "@refinedev/core";
import type { Operation, PipelineData } from "@repo/schemas";
import { ResourceName } from "../constants";
import type { createPipelineAgentSessionsClient } from "./pipelineAgentSessionsClient";

type SessionsClient = ReturnType<typeof createPipelineAgentSessionsClient>;

/**
 * 把 pipeline-agent 生成的草稿物化成本地 Pipeline + 引用的 Operations。
 * 已在本地存在的直接复用 id,不重复创建。
 */
export const createMaterializeGeneratedPipeline =
  ({ client, dataProvider }: { client: SessionsClient; dataProvider: DataProvider }) =>
  async (pipelineId: string, projectId?: string | null) => {
    const { operations, pipeline } = await client.getGeneratedPipelineMaterialization(pipelineId);

    const existingPipeline = await dataProvider.getOne<PipelineData>({
      resource: ResourceName.pipelines,
      id: pipeline.id,
    });
    if (existingPipeline.data) {
      return existingPipeline.data.id;
    }

    await Promise.all(
      operations.map(async (operation: Operation) => {
        const existing = await dataProvider.getOne<Operation>({
          resource: ResourceName.operations,
          id: operation.id,
        });
        if (existing.data) {
          return;
        }

        await dataProvider.create<Operation>({
          resource: ResourceName.operations,
          variables: operation,
        });
      }),
    );

    const { createdAt: _createdAt, updatedAt: _updatedAt, ...pipelineInput } = pipeline;
    const result = await dataProvider.create<PipelineData>({
      resource: ResourceName.pipelines,
      variables: projectId === undefined ? pipelineInput : { ...pipelineInput, projectId },
    });

    return result.data.id;
  };

export type MaterializeGeneratedPipeline = ReturnType<typeof createMaterializeGeneratedPipeline>;
