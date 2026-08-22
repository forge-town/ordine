import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { api } from "../api";
import { canCallMcpTool, describeMcpPolicyDenial, type McpPolicy } from "./policy";
import { publicMcpResources, readMcpResource } from "./resourceCatalog";
import { findMcpTool, publicMcpTools, type McpApiClient } from "./toolCatalog";

const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

type JsonRpcId = z.infer<typeof JsonRpcRequestSchema>["id"];
type JsonRpcResponse = Record<string, unknown> | null;

const success = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id: id ?? null,
  result,
});

const failure = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

const toolContent = (value: unknown, isError = false) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? String(value)),
    },
  ],
  ...(isError ? { isError: true } : {}),
});

const executeMcpTool = ({
  name,
  input,
  policy,
  apiClient,
}: {
  name: string;
  input: unknown;
  policy: McpPolicy;
  apiClient: McpApiClient;
}) => {
  const tool = findMcpTool(name);
  if (!tool) return Promise.resolve(toolContent(`Unknown tool: ${name}`, true));
  if (!canCallMcpTool(policy, tool.risk)) {
    return Promise.resolve(toolContent(describeMcpPolicyDenial(policy, tool.risk), true));
  }

  return tool.call(input, apiClient).then(
    (value) => toolContent(value),
    (error) => toolContent(error instanceof Error ? error.message : String(error), true),
  );
};

export const createOrdineMcpServer = ({
  policy,
  apiClient = api,
}: {
  policy: McpPolicy;
  apiClient?: McpApiClient;
}): Server => {
  const server = new Server(
    { name: "ordine", version: "0.0.2" },
    {
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
      },
      instructions: `ORDINE MCP policy=${policy.mode}; write=${policy.allowWrite}; irreversible=${policy.allowIrreversible}`,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: publicMcpTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    executeMcpTool({
      name: request.params.name,
      input: request.params.arguments ?? {},
      policy,
      apiClient,
    }),
  );
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: publicMcpResources(),
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
    readMcpResource({ uri: request.params.uri, policy, apiClient }),
  );

  return server;
};

/**
 * Compatibility seam for unit tests and embedders that still hand us a
 * decoded JSON-RPC request. The production stdio path below uses the official
 * MCP SDK for negotiation, validation, dispatch, and transport framing.
 */
export const handleMcpRequest = async ({
  request,
  policy,
  apiClient = api,
}: {
  request: unknown;
  policy: McpPolicy;
  apiClient?: McpApiClient;
}): Promise<JsonRpcResponse> => {
  const parsed = JsonRpcRequestSchema.safeParse(request);
  if (!parsed.success) return failure(null, -32_600, "Invalid JSON-RPC request");
  const { id, method, params } = parsed.data;

  if (method.startsWith("notifications/")) return null;
  if (method === "ping") return success(id, {});
  if (method === "initialize") {
    return success(id, {
      protocolVersion: "2025-06-18",
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
      },
      serverInfo: { name: "ordine", version: "0.0.2" },
      instructions: `ORDINE MCP policy=${policy.mode}; write=${policy.allowWrite}; irreversible=${policy.allowIrreversible}`,
    });
  }
  if (method === "tools/list") return success(id, { tools: publicMcpTools() });
  if (method === "resources/list") return success(id, { resources: publicMcpResources() });
  if (method === "resources/read") {
    const read = z.object({ uri: z.string().min(1) }).safeParse(params);
    if (!read.success) return failure(id, -32_602, "Invalid resources/read parameters");

    return readMcpResource({ uri: read.data.uri, policy, apiClient }).then(
      (value) => success(id, value),
      (error) => failure(id, -32_602, error instanceof Error ? error.message : String(error)),
    );
  }
  if (method !== "tools/call") return failure(id, -32_601, `Method not found: ${method}`);

  const call = z
    .object({ name: z.string().min(1), arguments: z.unknown().optional() })
    .safeParse(params);
  if (!call.success) return failure(id, -32_602, "Invalid tools/call parameters");

  return success(
    id,
    await executeMcpTool({
      name: call.data.name,
      input: call.data.arguments ?? {},
      policy,
      apiClient,
    }),
  );
};

export const startMcpServer = async (policy: McpPolicy): Promise<void> => {
  const server = createOrdineMcpServer({ policy });
  const transport = new StdioServerTransport();
  const ended = new Promise<void>((resolve) => process.stdin.once("end", resolve));
  await server.connect(transport);
  await ended;
  await server.close();
};
