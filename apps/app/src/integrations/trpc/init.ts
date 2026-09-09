import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

export type TrpcContext = {
  session: unknown | null;
};

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
const authoringProcedure = t.procedure.use(({ path, next }) => {
  if (
    [
      "pipelines.run",
      "pipelines.cancel",
      "operations.run",
      "routines.runNow",
      "jobs.pause",
      "jobs.resume",
      "jobs.cancel",
      "jobs.create",
      "jobs.updateStatus",
    ].includes(path)
  )
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "旧运行接口已停用，请通过新版运行请求确认执行。",
    });

  return next();
});
export const publicProcedure = authoringProcedure;
export const authedProcedure = authoringProcedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: ctx.session,
    },
  });
});
