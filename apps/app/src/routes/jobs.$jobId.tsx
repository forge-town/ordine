import { createFileRoute } from "@tanstack/react-router";
import { JobDetailPage } from "@/pages/JobDetailPage";
import { getJobById } from "@/services/jobsService";

export const Route = createFileRoute("/jobs/$jobId")({
  loader: ({ params }) => getJobById({ data: { id: params.jobId } }),
  component: JobDetailPage,
});
