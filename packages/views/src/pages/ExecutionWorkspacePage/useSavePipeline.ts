import { useUpdate } from "@refinedev/core";
import { SavePipelineDefinitionSchema, type PipelineDefinition } from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
export const useSavePipeline = () => {
  const { mutateAsync } = useUpdate<PipelineDefinition>();
  const { store, pipelines } = useWorkspaceData();

  return async (pipeline: PipelineDefinition) => {
    const { apiVersion, id, revision, ...definition } = pipeline;
    const values = SavePipelineDefinitionSchema.parse({
      apiVersion,
      pipelineId: id,
      expectedRevision: revision,
      definition,
    });
    const response = await mutateAsync({ resource: "pipelines", id, values });
    store.getState().patch({
      draft: response.data,
      dirty: false,
      notice: `已保存 Pipeline r${response.data.revision}`,
    });
    void pipelines.query.refetch();

    return response.data;
  };
};
