import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeEditPage } from "@/pages/BestPracticeEditPage";

export const Route = createFileRoute("/_layout/best-practices/$bestPracticeId/edit")({
  component: BestPracticeEditPage,
});
