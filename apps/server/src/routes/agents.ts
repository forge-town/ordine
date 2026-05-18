import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import { TRPCError } from "@trpc/server";
import { getAgentApiAuthState } from "../integrations/auth";
import {
  createServerTrpcContext,
  serverTrpcRouter,
} from "../integrations/trpc";

export const agentsRoutes = new Hono();

const parseJsonBody = (request: Request) =>
  ResultAsync.fromPromise(request.json() as Promise<unknown>, () => undefined);

const runService = <T>(promise: Promise<T>) =>
  ResultAsync.fromPromise(promise, () => undefined);

const trpcStatusCode = (error: unknown) => {
  if (!(error instanceof TRPCError)) return 500;
  if (error.code === "BAD_REQUEST") return 400;
  if (error.code === "UNAUTHORIZED") return 401;
  if (error.code === "NOT_FOUND") return 404;

  return 500;
};

const trpcErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

agentsRoutes.use("*", async (c, next) => {
  const authState = getAgentApiAuthState(c.req.raw.headers);
  if (!authState.configured) {
    return c.json({ error: "Agent API authentication is not configured" }, 500);
  }

  if (!authState.authenticated) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return next();
});

agentsRoutes.get("/", async (c) => {
  const caller = serverTrpcRouter.createCaller(
    createServerTrpcContext(c.req.raw.headers),
  );
  const agents = await runService(caller.agents.getMany());
  if (agents.isErr()) {
    return c.json(
      { error: trpcErrorMessage(agents.error) },
      trpcStatusCode(agents.error),
    );
  }

  return c.json(agents.value);
});

agentsRoutes.post("/", async (c) => {
  const body = await parseJsonBody(c.req.raw);
  if (body.isErr()) return c.json({ error: "Invalid JSON body" }, 400);

  const caller = serverTrpcRouter.createCaller(
    createServerTrpcContext(c.req.raw.headers),
  );
  const agent = await runService(
    caller.agents.create(
      body.value as Parameters<typeof caller.agents.create>[0],
    ),
  );
  if (agent.isErr()) {
    return c.json(
      { error: trpcErrorMessage(agent.error) },
      trpcStatusCode(agent.error),
    );
  }

  return c.json(agent.value, 201);
});

agentsRoutes.get("/:id", async (c) => {
  const caller = serverTrpcRouter.createCaller(
    createServerTrpcContext(c.req.raw.headers),
  );
  const agent = await runService(
    caller.agents.getById({ id: c.req.param("id") }),
  );
  if (agent.isErr()) {
    return c.json(
      { error: trpcErrorMessage(agent.error) },
      trpcStatusCode(agent.error),
    );
  }
  if (!agent.value) return c.json({ error: "Agent not found" }, 404);

  return c.json(agent.value);
});

agentsRoutes.patch("/:id", async (c) => {
  const body = await parseJsonBody(c.req.raw);
  if (body.isErr()) return c.json({ error: "Invalid JSON body" }, 400);

  const caller = serverTrpcRouter.createCaller(
    createServerTrpcContext(c.req.raw.headers),
  );
  const patch = body.value as Parameters<
    typeof caller.agents.update
  >[0]["patch"];
  const agent = await runService(
    caller.agents.update({ id: c.req.param("id"), patch }),
  );
  if (agent.isErr()) {
    return c.json(
      { error: trpcErrorMessage(agent.error) },
      trpcStatusCode(agent.error),
    );
  }

  return c.json(agent.value);
});

agentsRoutes.delete("/:id", async (c) => {
  const caller = serverTrpcRouter.createCaller(
    createServerTrpcContext(c.req.raw.headers),
  );
  const existing = await runService(
    caller.agents.getById({ id: c.req.param("id") }),
  );
  if (existing.isErr()) {
    return c.json(
      { error: trpcErrorMessage(existing.error) },
      trpcStatusCode(existing.error),
    );
  }
  if (!existing.value) return c.json({ error: "Agent not found" }, 404);

  const deleted = await runService(
    caller.agents.delete({ id: c.req.param("id") }),
  );
  if (deleted.isErr()) {
    return c.json(
      { error: trpcErrorMessage(deleted.error) },
      trpcStatusCode(deleted.error),
    );
  }

  return c.body(null, 204);
});
