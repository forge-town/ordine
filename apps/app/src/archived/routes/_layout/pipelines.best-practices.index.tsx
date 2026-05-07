import { createFileRoute } from "@tanstack/react-router";
import { BestPracticesPage } from "@/pages/BestPracticesPage";

export const Route = createFileRoute("/_layout/pipelines/best-practices/")({
  component: BestPracticesPage,
});
