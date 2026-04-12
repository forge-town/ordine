import { createFileRoute } from "@tanstack/react-router";
import { RuleDetailPage } from "@/pages/RuleDetailPage";
import { getRuleById } from "@/services/rulesService";

export const Route = createFileRoute("/_layout/rules/$ruleId/")({
  loader: ({ params }) => getRuleById({ data: { id: params.ruleId } }),
  component: RuleDetailPage,
});
