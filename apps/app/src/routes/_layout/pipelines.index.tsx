import { createFileRoute } from "@tanstack/react-router";
import { PipelinesPage } from "@repo/views/PipelinesPage";

export const Route = createFileRoute("/_layout/pipelines/")({
  head: () => ({
    meta: [{ title: "Pipelines | Ordine" }],
  }),
  component: PipelinesPage,
});
