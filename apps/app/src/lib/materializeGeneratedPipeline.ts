import type { Operation, PipelineData } from "@repo/schemas";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import { pipelineAgentSessionsClient } from "./pipelineAgentSessionsClient";

export const materializeGeneratedPipeline = async (
  pipelineId: string,
  projectId?: string | null,
) => {
  const { operations, pipeline } =
    await pipelineAgentSessionsClient.getGeneratedPipelineMaterialization(pipelineId);

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
