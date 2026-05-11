import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { ResultAsync } from "neverthrow";
import { auth } from "@/integrations/better-auth";
import { appRouter } from "@/integrations/trpc/router";

const getSession = (request: Request) =>
  ResultAsync.fromPromise(
    auth.api.getSession({ headers: request.headers }),
    () => undefined,
  );

const handleRequest = (request: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: async () => ({
      session: (await getSession(request)).unwrapOr(null),
    }),
  });

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleRequest(request),
      POST: ({ request }) => handleRequest(request),
    },
  },
});
