import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/pages/DashboardPage";
import { getPipelines } from "@/services/pipelinesService";
import { getGithubProjects } from "@/services/githubProjectsService";
import { getJobs } from "@/services/jobsService";
import { getWorks } from "@/services/worksService";

export const Route = createFileRoute("/")({
  loader: async () => ({
    pipelines: await getPipelines(),
    projects: await getGithubProjects(),
    jobs: await getJobs(),
    works: await getWorks(),
  }),
  component: DashboardPage,
});
