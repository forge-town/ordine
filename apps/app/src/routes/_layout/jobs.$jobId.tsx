import { createFileRoute } from "@tanstack/react-router";
import { JobDetailPage } from "@/pages/JobDetailPage";
import { getJobById } from "@/services/jobsService";

export const Route = createFileRoute("/_layout/jobs/$jobId")({
  loader: ({ params }) => getJobById({ data: { id: params.jobId } }),
  component: JobDetailPage,
});
