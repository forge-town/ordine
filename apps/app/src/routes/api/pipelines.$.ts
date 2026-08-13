import { createFileRoute } from "@tanstack/react-router";
import { proxyOrdineApiRequest } from "@/lib/proxyOrdineApiRequest";

export const Route = createFileRoute("/api/pipelines/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyOrdineApiRequest(request),
    },
  },
});
