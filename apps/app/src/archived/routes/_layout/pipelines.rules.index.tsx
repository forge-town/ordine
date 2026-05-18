import { createFileRoute } from "@tanstack/react-router";
import { RulesPage } from "@/pages/RulesPage";

export const Route = createFileRoute("/_layout/pipelines/rules/")({
  head: () => ({
    meta: [{ title: "Rules | Ordine" }],
  }),
  component: RulesPage,
});
