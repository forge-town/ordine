import { ResultAsync } from "neverthrow";
import { auth } from "@/integrations/better-auth";
import { getServerEnv } from "@/integrations/server-env";

const toProxyError = (error: unknown) =>
  error instanceof Error ? error : new Error("Ordine API request failed");

export const proxyOrdineApiRequest = async (request: Request, upstreamAuthorization?: string) => {
  const requestUrl = new URL(request.url);
  const { ORDINE_API_PROXY_TARGET } = getServerEnv();
  const upstreamUrl = new URL(
    `${requestUrl.pathname}${requestUrl.search}`,
    ORDINE_API_PROXY_TARGET,
  );
  const canHaveBody = request.method !== "GET" && request.method !== "HEAD";
  const headers = new Headers(request.headers);
  if (upstreamAuthorization) headers.set("authorization", upstreamAuthorization);
  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    redirect: "manual",
    ...(canHaveBody
      ? ({ body: request.body, duplex: "half" } as RequestInit & { duplex: "half" })
      : {}),
  });
  const result = await ResultAsync.fromPromise(fetch(upstreamRequest), toProxyError);

  if (result.isErr()) {
    if (request.method === "GET" && requestUrl.pathname === "/api/agent-threads/capabilities") {
      return Response.json(
        {
          enabled: false,
          toolContractVersion: 1,
          toolCount: 22,
          runtimes: [],
        },
        { headers: { "x-ordine-agent-control-state": "api-unavailable" } },
      );
    }

    return Response.json(
      {
        error: "Ordine API is unavailable. Start the API server and try again.",
      },
      { status: 503 },
    );
  }

  return result.value;
};

export const proxyAgentControlApiRequest = async (request: Request) => {
  const session = await ResultAsync.fromPromise(
    auth.api.getSession({ headers: request.headers }),
    toProxyError,
  );
  if (session.isErr() || !session.value) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ORDINE_AGENT_API_TOKEN } = getServerEnv();
  if (!ORDINE_AGENT_API_TOKEN) {
    return Response.json(
      { error: "ORDINE Agent API authentication is not configured" },
      { status: 503 },
    );
  }

  return proxyOrdineApiRequest(request, `Bearer ${ORDINE_AGENT_API_TOKEN}`);
};
