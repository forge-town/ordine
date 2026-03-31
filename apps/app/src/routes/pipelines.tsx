import { createFileRoute } from "@tanstack/react-router";
import { PipelinesPage } from "@/pages/PipelinesPage";
import { getPipelines } from "@/services/pipelinesService";

export const Route = createFileRoute("/pipelines")({
  loader: () => getPipelines(),
  component: PipelinesPage,
});
