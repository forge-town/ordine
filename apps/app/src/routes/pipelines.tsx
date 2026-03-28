import { createFileRoute } from "@tanstack/react-router";
import { PipelinesPage } from "@/pages/PipelinesPage";

export const Route = createFileRoute("/pipelines")({
  component: PipelinesPage,
});
