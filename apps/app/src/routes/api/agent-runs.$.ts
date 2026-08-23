import { createFileRoute } from "@tanstack/react-router";
import { proxyOrdineApiRequest } from "@/lib/proxyOrdineApiRequest";

export const Route = createFileRoute("/api/agent-runs/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyOrdineApiRequest(request),
      POST: ({ request }) => proxyOrdineApiRequest(request),
    },
  },
});
