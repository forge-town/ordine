import { createFileRoute } from "@tanstack/react-router";
import { PipelineDetailPage } from "@/pages/PipelinesPage";

export const Route = createFileRoute("/_layout/pipelines/$pipelineId")({
  component: PipelineDetailPage,
});
