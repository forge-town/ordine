import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono, type Context } from "hono";
import {
  listAgentControlTools,
  toMcpToolDefinition,
  type AgentControlInvocationContext,
} from "@repo/agent-control";
import type { AgentControlAudience, AgentControlScope } from "@repo/schemas";
import { getAgentApiAuthState } from "../integrations/auth";
import { getEnv } from "../integrations/env";
import { agentControlService, agentRunCapabilityStore } from "../services.js";

const READONLY_SCOPES = new Set<AgentControlScope>(["resources:read", "canvas:read"]);
const READWRITE_SCOPES = new Set<AgentControlScope>([
  "resources:read",
  "resources:write",
  "canvas:read",
  "canvas:draft",
  "execute",
  "irreversible:request",
]);

const toolContent = (result: Awaited<ReturnType<typeof agentControlService.invoke>>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(result) }],
  structuredContent: result,
  ...(result.status === "failed" ? { isError: true } : {}),
});

const createMcpServer = ({
  context,
  allowedTools,
}: {
  context: AgentControlInvocationContext;
  allowedTools?: ReadonlySet<string>;
}) => {
  const server = new Server(
    { name: "ordine-agent-control", version: "0.0.2" },
    { capabilities: { tools: { listChanged: false } } },
  );
  const listed = listAgentControlTools({
    audience: context.audience,
    scopes: context.scopes,
  }).filter((tool) => !allowedTools || allowedTools.has(tool.name));
  const listedNames = new Set<string>(listed.map((tool) => tool.name));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listed.map(toMcpToolDefinition),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!listedNames.has(request.params.name)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              code: "TOOL_NOT_AUTHORIZED",
              message: `${request.params.name} is not authorized for this MCP audience.`,
            }),
          },
        ],
        isError: true,
      };
    }
    const result = await agentControlService.invoke(
      request.params.name,
      request.params.arguments ?? {},
      context,
    );

    return toolContent(result);
  });

  return server;
};

const handleMcp = async ({
  request,
  audience,
  scopes,
  threadId,
  runId,
  readonly,
  allowedTools,
}: {
  request: Request;
  audience: AgentControlAudience;
  scopes: ReadonlySet<AgentControlScope>;
  threadId: string;
  runId: string | null;
  readonly: boolean;
  allowedTools?: ReadonlySet<string>;
}): Promise<Response> => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer({
    context: {
      actor: "local-owner",
      audience,
      scopes,
      threadId,
      runId,
      readonly,
    },
    allowedTools,
  });
  await server.connect(transport);

  return transport.handleRequest(request);
};

const publicAuth = (headers: Headers): Response | null => {
  if (!getEnv().ORDINE_AGENT_CONTROL_ENABLED) {
    return Response.json({ error: "ORDINE Agent Control is disabled" }, { status: 503 });
  }
  const auth = getAgentApiAuthState(headers);
  if (!auth.configured) {
    return Response.json({ error: "Agent API authentication is not configured" }, { status: 503 });
  }
  if (!auth.authenticated) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return null;
};

export const agentControlMcpRoutes = new Hono();

agentControlMcpRoutes.all("/", async (context) => {
  const denied = publicAuth(context.req.raw.headers);
  if (denied) return denied;

  return handleMcp({
    request: context.req.raw,
    audience: "public-readwrite",
    scopes: READWRITE_SCOPES,
    threadId: agentControlService.defaultThreadId("public-readwrite"),
    runId: null,
    readonly: false,
  });
});

agentControlMcpRoutes.all("/readonly", async (context) => {
  const denied = publicAuth(context.req.raw.headers);
  if (denied) return denied;

  return handleMcp({
    request: context.req.raw,
    audience: "public-readonly",
    scopes: READONLY_SCOPES,
    threadId: agentControlService.defaultThreadId("public-readonly"),
    runId: null,
    readonly: true,
  });
});

const bearerToken = (value: string | undefined): string =>
  value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : "";

const isLoopback = (context: Context): boolean => {
  const address = getConnInfo(context).remote.address;

  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
};

export const internalAgentControlMcpRoutes = new Hono();

internalAgentControlMcpRoutes.all("/:runId/mcp", async (context) => {
  if (!getEnv().ORDINE_AGENT_CONTROL_ENABLED) {
    return context.json({ error: "ORDINE Agent Control is disabled" }, 503);
  }
  if (!isLoopback(context)) return context.json({ error: "Loopback only" }, 403);
  const runId = context.req.param("runId");
  const verification = agentRunCapabilityStore.verify({
    token: bearerToken(context.req.header("Authorization")),
    runId,
  });
  if (!verification.ok) {
    return context.json(
      { error: verification.code },
      verification.code === "CAPABILITY_EXPIRED" ? 410 : 401,
    );
  }

  return handleMcp({
    request: context.req.raw,
    audience: "internal-run",
    scopes: verification.grant.scopes,
    threadId: verification.grant.threadId,
    runId,
    readonly: false,
    allowedTools: verification.grant.tools,
  });
});
