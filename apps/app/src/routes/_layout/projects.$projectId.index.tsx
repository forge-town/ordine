import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";

export const Route = createFileRoute("/_layout/projects/$projectId/")({
  component: ProjectDetailPage,
});
