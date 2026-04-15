import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeDetailPage } from "@/pages/BestPracticeDetailPage";

export const Route = createFileRoute("/_layout/best-practices/$bestPracticeId/")({
  component: BestPracticeDetailPage,
});
