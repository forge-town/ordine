import { createFileRoute } from "@tanstack/react-router";
import { ConversationsPage } from "@repo/views/ConversationsPage";

export const Route = createFileRoute("/_layout/assistant")({
  head: () => ({
    meta: [{ title: "Conversations | Ordine" }],
  }),
  component: ConversationsPage,
});
