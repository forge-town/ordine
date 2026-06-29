import { createFileRoute } from "@tanstack/react-router";
import { AgentDetailPage } from "@repo/views/AgentDetailPage";

export const Route = createFileRoute("/agents/$agentId/")({
  component: AgentDetailPage,
});
