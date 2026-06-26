import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "@repo/views/JobsPage";

export const Route = createFileRoute("/pipelines/jobs")({
  component: JobsPage,
});
