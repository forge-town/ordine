import { createFileRoute } from "@tanstack/react-router";
import { AgentDetailPage } from "@/pages/AgentDetailPage";

export const Route = createFileRoute("/_layout/agents/$agentId/")({
  component: AgentDetailPage,
});
