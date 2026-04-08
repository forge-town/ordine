import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "@/pages/JobsPage";
import { getJobs } from "@/services/jobsService";

export const Route = createFileRoute("/_layout/jobs/")({
  loader: () => getJobs(),
  component: JobsPage,
});
