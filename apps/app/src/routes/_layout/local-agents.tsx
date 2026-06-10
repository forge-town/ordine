import { createFileRoute } from "@tanstack/react-router";
import { LocalAgentsPage } from "@/pages/LocalAgentsPage";

export const Route = createFileRoute("/_layout/local-agents")({
  head: () => ({
    meta: [{ title: "Local Agents | Ordine" }],
  }),
  component: LocalAgentsPage,
});
