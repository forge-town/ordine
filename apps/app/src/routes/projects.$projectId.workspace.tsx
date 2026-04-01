import { createFileRoute } from "@tanstack/react-router";
import { ProjectWorkspacePage } from "@/pages/ProjectWorkspacePage";
import { getGithubProjectById } from "@/services/githubProjectsService";
import { getPipelines } from "@/services/pipelinesService";

export const Route = createFileRoute("/projects/$projectId/workspace")({
  loader: async ({ params }) => ({
    project: await getGithubProjectById({ data: { id: params.projectId } }),
    pipelines: await getPipelines(),
  }),
  component: ProjectWorkspacePage,
});
