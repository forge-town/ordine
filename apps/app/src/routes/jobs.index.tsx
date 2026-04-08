import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "@/pages/JobsPage";
import { getJobs } from "@/services/jobsService";

export const Route = createFileRoute("/jobs/")({
  loader: () => getJobs(),
  component: JobsPage,
});
