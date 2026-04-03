import { createFileRoute } from "@tanstack/react-router";
import { PipelineDetailPage } from "@/pages/PipelinesPage";
import { getPipelineById } from "@/services/pipelinesService";
import { getOperations } from "@/services/operationsService";

export const Route = createFileRoute("/pipelines/$pipelineId")({
  loader: async ({ params }) => {
    const [pipeline, operations] = await Promise.all([
      getPipelineById({ data: { id: params.pipelineId } }),
      getOperations(),
    ]);
    return { pipeline, operations };
  },
  component: PipelineDetailPage,
});
