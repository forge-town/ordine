import { createFileRoute } from "@tanstack/react-router";
import { JobDetailPage } from "@/pages/JobDetailPage";

export const Route = createFileRoute("/_layout/jobs/$jobId")({
  component: JobDetailPage,
});
