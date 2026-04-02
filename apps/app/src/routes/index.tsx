import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/pages/DashboardPage";
import { getPipelines } from "@/services/pipelinesService";
import { getGithubProjects } from "@/services/githubProjectsService";
import { getJobs } from "@/services/jobsService";

export const Route = createFileRoute("/")({
  loader: async () => ({
    pipelines: await getPipelines(),
    projects: await getGithubProjects(),
    jobs: await getJobs(),
  }),
  component: DashboardPage,
});
