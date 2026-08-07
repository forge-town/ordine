import { createFileRoute } from "@tanstack/react-router";
import { LocalAgentsPage } from "@repo/views/LocalAgentsPage";

export const Route = createFileRoute("/local-agents")({ component: LocalAgentsPage });
