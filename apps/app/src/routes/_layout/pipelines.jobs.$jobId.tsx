import { createFileRoute } from "@tanstack/react-router";
import { JobDetailPage } from "@repo/views/JobDetailPage";

export const Route = createFileRoute("/_layout/pipelines/jobs/$jobId")({
  component: JobDetailPage,
});
