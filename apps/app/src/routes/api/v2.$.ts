import { createFileRoute } from "@tanstack/react-router";
import { proxyExecutionApiRequest } from "@/lib/proxyExecutionApiRequest";

export const Route = createFileRoute("/api/v2/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyExecutionApiRequest(request),
      POST: ({ request }) => proxyExecutionApiRequest(request),
      PUT: ({ request }) => proxyExecutionApiRequest(request),
      DELETE: ({ request }) => proxyExecutionApiRequest(request),
    },
  },
});
