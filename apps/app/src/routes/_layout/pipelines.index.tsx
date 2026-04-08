import { createFileRoute } from "@tanstack/react-router";
import { PipelinesPage } from "@/pages/PipelinesPage";
import { getPipelines } from "@/services/pipelinesService";

export const Route = createFileRoute("/_layout/pipelines/")({
  loader: () => getPipelines(),
  component: PipelinesPage,
});
