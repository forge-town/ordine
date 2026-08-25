import { createFileRoute } from "@tanstack/react-router";
import { proxyOrdineApiRequest } from "@/lib/proxyOrdineApiRequest";

export const Route = createFileRoute("/api/agent-threads/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyOrdineApiRequest(request),
      PATCH: ({ request }) => proxyOrdineApiRequest(request),
      POST: ({ request }) => proxyOrdineApiRequest(request),
    },
  },
});
