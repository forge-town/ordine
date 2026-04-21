import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/pages/ProjectsPage";

export const Route = createFileRoute("/_layout/projects/")({
  component: ProjectsPage,
});
