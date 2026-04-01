import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { getGithubProjectById } from "@/services/githubProjectsService";
import { getWorksByProject } from "@/services/worksService";
import { getPipelines } from "@/services/pipelinesService";

export const Route = createFileRoute("/projects/$projectId")({
  loader: async ({ params }) => ({
    project: await getGithubProjectById({ data: { id: params.projectId } }),
    works: await getWorksByProject({ data: { projectId: params.projectId } }),
    pipelines: await getPipelines(),
  }),
  component: ProjectDetailPage,
});
