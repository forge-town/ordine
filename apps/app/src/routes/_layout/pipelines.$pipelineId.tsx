import { createFileRoute } from "@tanstack/react-router";
import { PipelineDetailPage } from "@repo/views/PipelineDetailPage";

export const Route = createFileRoute("/_layout/pipelines/$pipelineId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { pipelineId } = Route.useParams();

  return <PipelineDetailPage pipelineId={pipelineId} />;
}
