import { createFileRoute } from "@tanstack/react-router";
import { RuleDetailPage } from "@/pages/RuleDetailPage";

export const Route = createFileRoute("/_layout/pipelines/rules/$ruleId/")({
  component: RuleDetailPage,
});
