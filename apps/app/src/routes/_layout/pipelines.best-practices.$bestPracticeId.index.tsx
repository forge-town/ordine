import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeDetailPage } from "@/pages/BestPracticeDetailPage";

export const Route = createFileRoute("/_layout/pipelines/best-practices/$bestPracticeId/")({
  component: BestPracticeDetailPage,
});
