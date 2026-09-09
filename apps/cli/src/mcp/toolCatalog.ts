import { EXECUTION_ACTIONS, type ExecutionApiClient, type ExecutionAction } from "../execution";

export type McpApiClient = ExecutionApiClient;
export type McpToolDefinition = ExecutionAction;
export const ORDINE_MCP_TOOLS: readonly McpToolDefinition[] = EXECUTION_ACTIONS.map((action) => ({
  ...action,
  name: `ordine.v2.${action.name}`,
}));
export const findMcpTool = (name: string) => ORDINE_MCP_TOOLS.find((tool) => tool.name === name);
export const publicMcpTools = () =>
  ORDINE_MCP_TOOLS.map(({ name, description, inputSchema, risk }) => ({
    name,
    description,
    inputSchema: { ...inputSchema, type: "object" as const },
    annotations: {
      readOnlyHint: risk === "read",
      destructiveHint: risk === "irreversible" || risk === "execute",
      idempotentHint: risk === "read",
      openWorldHint: false,
    },
  }));
