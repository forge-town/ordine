import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { getEnv } from "../env";

const parseBearerToken = (value: string | undefined) =>
  value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : "";

export const isValidAgentApiToken = (value: string | undefined, expectedToken: string) => {
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(parseBearerToken(value));

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const getAgentApiAuthState = (headers: Headers) => {
  const { ORDINE_AGENT_API_TOKEN } = getEnv();

  return {
    configured: Boolean(ORDINE_AGENT_API_TOKEN),
    authenticated: ORDINE_AGENT_API_TOKEN
      ? isValidAgentApiToken(headers.get("authorization") ?? undefined, ORDINE_AGENT_API_TOKEN)
      : false,
  };
};

export const agentApiAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const env = getEnv();
  // Desktop mode is already protected by the app-wide desktop token middleware.
  if (env.DESKTOP_MODE) return next();

  const authState = getAgentApiAuthState(c.req.raw.headers);
  if (!authState.configured) {
    return c.json({ error: "Agent API authentication is not configured" }, 500);
  }
  if (!authState.authenticated) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return next();
};
