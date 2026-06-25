import { createFileRoute } from "@tanstack/react-router";
import { PipelinesPage } from "@repo/views/PipelinesPage";

export const Route = createFileRoute("/pipelines/")({
  component: PipelinesPage,
});
