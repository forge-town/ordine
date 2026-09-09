import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getProductSession } from "@/lib/productSession";
import { appRouter } from "@/integrations/trpc/router";

const handleRequest = async (request: Request) => {
  const checked = await getProductSession(request);
  if (checked.response) return checked.response;

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => ({ session: checked.session }),
  });
};

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleRequest(request),
      POST: ({ request }) => handleRequest(request),
    },
  },
});
