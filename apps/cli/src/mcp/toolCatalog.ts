import {
  AGENT_CONTROL_TOOLS,
  findAgentControlTool,
  parseAgentControlToolInput,
  toMcpToolDefinition,
} from "@repo/agent-control";
import type { McpToolRisk } from "./policy";

type JsonSchema = Record<string, unknown>;
type ApiCallResult = { ok: true; data: unknown } | { ok: false; status: number; message: string };

export type McpApiClient = {
  get: (path: string) => Promise<ApiCallResult>;
  post: (path: string, body?: unknown) => Promise<ApiCallResult>;
  patch: (path: string, body: unknown) => Promise<ApiCallResult>;
  del: (path: string) => Promise<ApiCallResult>;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  risk: McpToolRisk;
  call: (input: unknown, apiClient: McpApiClient) => Promise<unknown>;
};

const unwrapApi = (result: ApiCallResult, action: string): unknown => {
  if (!result.ok) throw new Error(`Failed to ${action}: ${result.status} ${result.message}`);

  return result.data;
};

export const ORDINE_MCP_TOOLS: readonly McpToolDefinition[] = AGENT_CONTROL_TOOLS.map((tool) => {
  const publicDefinition = toMcpToolDefinition(tool);

  return {
    name: tool.name,
    description: publicDefinition.description,
    inputSchema: publicDefinition.inputSchema as JsonSchema,
    risk: tool.risk,
    call: async (input, apiClient) => {
      const parsed = parseAgentControlToolInput(tool.name, input);

      return unwrapApi(
        await apiClient.post("/api/agent-control/tools/call", {
          name: tool.name,
          input: parsed,
        }),
        `call ${tool.name}`,
      );
    },
  };
});

export const findMcpTool = (name: string): McpToolDefinition | undefined => {
  if (!findAgentControlTool(name)) return undefined;

  return ORDINE_MCP_TOOLS.find((tool) => tool.name === name);
};

export const publicMcpTools = () => AGENT_CONTROL_TOOLS.map(toMcpToolDefinition);
