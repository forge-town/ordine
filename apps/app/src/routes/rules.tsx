import { createFileRoute } from "@tanstack/react-router";
import { RulesPage } from "@/pages/RulesPage";
import { getRules } from "@/services/rulesService";

export const Route = createFileRoute("/rules")({
  loader: () => getRules(),
  component: RulesPage,
});
