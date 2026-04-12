import { createFileRoute } from "@tanstack/react-router";
import { RuleEditPage } from "@/pages/RuleEditPage";
import { getRuleById } from "@/services/rulesService";

export const Route = createFileRoute("/_layout/rules/$ruleId/edit")({
  loader: ({ params }) => getRuleById({ data: { id: params.ruleId } }),
  component: RuleEditPage,
});
