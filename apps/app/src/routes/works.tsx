import { createFileRoute } from "@tanstack/react-router";
import { WorksPage } from "@/pages/WorksPage";
import { getWorks } from "@/services/worksService";

export const Route = createFileRoute("/works")({
  loader: () => getWorks(),
  component: WorksPage,
});
