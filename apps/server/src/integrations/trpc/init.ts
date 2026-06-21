import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getAgentApiAuthState } from "../auth";

export type ServerTrpcContext = {
  agentApiAuth: ReturnType<typeof getAgentApiAuthState>;
};

const t = initTRPC.context<ServerTrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.agentApiAuth.configured) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Agent API authentication is not configured",
    });
  }

  if (!ctx.agentApiAuth.authenticated) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx });
});

export const createServerTrpcContext = (
  headers: Headers,
): ServerTrpcContext => ({
  agentApiAuth: getAgentApiAuthState(headers),
});
