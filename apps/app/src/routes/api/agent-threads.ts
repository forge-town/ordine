import { createFileRoute } from "@tanstack/react-router";
import { proxyAgentControlApiRequest } from "@/lib/proxyOrdineApiRequest";

export const Route = createFileRoute("/api/agent-threads")({
  server: {
    handlers: {
      GET: ({ request }) => proxyAgentControlApiRequest(request),
      POST: ({ request }) => proxyAgentControlApiRequest(request),
    },
  },
});
