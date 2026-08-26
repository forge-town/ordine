import { createFileRoute } from "@tanstack/react-router";
import { ConversationsPage } from "@repo/views/ConversationsPage";

export const Route = createFileRoute("/assistant")({
  component: ConversationsPage,
});
