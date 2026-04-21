import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "@/pages/JobsPage";

export const Route = createFileRoute("/_layout/jobs/")({
  component: JobsPage,
});
