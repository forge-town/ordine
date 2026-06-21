import { createFileRoute } from "@tanstack/react-router";
import { ProjectWorkspacePage } from "@/pages/ProjectWorkspacePage";

export const Route = createFileRoute("/_layout/projects/$projectId/workspace")({
  component: ProjectWorkspacePage,
});
