import { createFileRoute } from "@tanstack/react-router";
import { proxyOrdineApiRequest } from "@/lib/proxyOrdineApiRequest";

export const Route = createFileRoute("/api/pipeline-agent-sessions")({
  server: {
    handlers: {
      POST: ({ request }) => proxyOrdineApiRequest(request),
    },
  },
});
