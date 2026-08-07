import { createFileRoute } from "@tanstack/react-router";
import { LocalAgentsPage } from "@repo/views/LocalAgentsPage";

export const Route = createFileRoute("/_layout/local-agents")({
  head: () => ({ meta: [{ title: "Local Agents | Ordine" }] }),
  component: LocalAgentsPage,
});
