import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { getGithubProjects } from "@/services/githubProjectsService";

export const Route = createFileRoute("/_layout/projects/")({
  loader: () => getGithubProjects(),
  component: ProjectsPage,
});
