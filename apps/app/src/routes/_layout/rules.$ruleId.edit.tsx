import { createFileRoute } from "@tanstack/react-router";
import { RuleEditPage } from "@/pages/RuleEditPage";

export const Route = createFileRoute("/_layout/rules/$ruleId/edit")({
  component: RuleEditPage,
});
