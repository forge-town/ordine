import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "@/pages/JobsPage";

export const Route = createFileRoute("/_layout/pipelines/jobs/")({
  head: () => ({
    meta: [{ title: "Jobs | Ordine" }],
  }),
  component: JobsPage,
});
