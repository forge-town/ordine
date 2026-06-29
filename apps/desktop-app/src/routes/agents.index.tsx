import { createFileRoute } from "@tanstack/react-router";
import { AgentsPage } from "@repo/views/AgentsPage";

export const Route = createFileRoute("/agents/")({
  component: AgentsPage,
});
