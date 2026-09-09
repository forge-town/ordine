import { ResultAsync } from "neverthrow";
import { getServerEnv } from "@/integrations/server-env";
import { getProductSession } from "./productSession";

const toProxyError = (error: unknown) =>
  error instanceof Error ? error : new Error("Ordine API request failed");

export const proxyOrdineApiRequest = async (request: Request) => {
  const checked = await getProductSession(request);
  if (checked.response) return checked.response;
  const requestUrl = new URL(request.url);
  const { ORDINE_API_PROXY_TARGET, ORDINE_AGENT_API_TOKEN } = getServerEnv();
  if (!ORDINE_AGENT_API_TOKEN)
    return Response.json({ error: "Agent API authentication is not configured" }, { status: 503 });
  const upstreamUrl = new URL(
    `${requestUrl.pathname}${requestUrl.search}`,
    ORDINE_API_PROXY_TARGET,
  );
  const canHaveBody = request.method !== "GET" && request.method !== "HEAD";
  const headers = new Headers();
  for (const name of ["content-type", "accept", "last-event-id"])
    if (request.headers.has(name)) headers.set(name, request.headers.get(name)!);
  headers.set("authorization", `Bearer ${ORDINE_AGENT_API_TOKEN}`);
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
  if (result.value.status >= 300 && result.value.status < 400) {
    const location = result.value.headers.get("location");
    const destination = location ? new URL(location, upstreamUrl) : null;
    // Thread event routes resolve to the same server's Agent Run stream.
    if (
      request.method !== "GET" ||
      !destination ||
      destination.origin !== upstreamUrl.origin ||
      !/^\/api\/agent-runs\/[^/]+\/events$/u.test(destination.pathname)
    )
      return Response.json({ error: "Unexpected upstream redirect" }, { status: 502 });
    const stream = await ResultAsync.fromPromise(
      fetch(destination, { headers, redirect: "error", signal: request.signal }),
      toProxyError,
    );
    if (stream.isErr())
      return Response.json({ error: "Agent event stream unavailable" }, { status: 503 });

    return new Response(stream.value.body, {
      status: stream.value.status,
      headers: {
        "content-type": stream.value.headers.get("content-type") ?? "text/event-stream",
        "cache-control": "no-store",
      },
    });
  }
  const responseHeaders = new Headers(result.value.headers);
  responseHeaders.delete("set-cookie");
  responseHeaders.delete("content-length");

  return new Response(result.value.body, { status: result.value.status, headers: responseHeaders });
};

export const proxyAgentControlApiRequest = proxyOrdineApiRequest;
