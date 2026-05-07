import { createFileRoute } from "@tanstack/react-router";
import { RuleCreatePage } from "@/pages/RuleCreatePage";

export const Route = createFileRoute("/_layout/pipelines/rules/create")({
  component: RuleCreatePage,
});
