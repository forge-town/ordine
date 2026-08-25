import { z } from "zod";
import type { McpPolicy } from "./policy";
import { publicMcpTools, type McpApiClient } from "./toolCatalog";

export const McpResourceUriSchema = z.enum([
  "ordine://workspace/context",
  "ordine://catalog/tools",
]);
export type McpResourceUri = z.infer<typeof McpResourceUriSchema>;

const resources = [
  {
    uri: "ordine://workspace/context",
    name: "ordine-workspace-context",
    title: "ORDINE workspace context",
    description: "Current ORDINE MCP workspace and safety policy.",
    mimeType: "application/json",
  },
  {
    uri: "ordine://catalog/tools",
    name: "ordine-tool-catalog",
    title: "ORDINE tool catalog",
    description: "Risk-annotated tools exposed by the ORDINE MCP server.",
    mimeType: "application/json",
  },
] as const;

export const publicMcpResources = () => resources.map((resource) => ({ ...resource }));

export const readMcpResource = async ({
  uri,
  policy,
  apiClient: _apiClient,
}: {
  uri: string;
  policy: McpPolicy;
  apiClient: McpApiClient;
}) => {
  const parsed = McpResourceUriSchema.safeParse(uri);
  if (!parsed.success) throw new Error(`Unknown ORDINE resource: ${uri}`);
  const value = parsed.data;
  if (value === "ordine://workspace/context") {
    return {
      contents: [
        {
          uri: value,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              apiUrl: process.env.ORDINE_API_URL ?? "http://localhost:9433",
              threadId: "agent-control-stdio-local-owner",
              policy,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
  if (value === "ordine://catalog/tools") {
    return {
      contents: [
        {
          uri: value,
          mimeType: "application/json",
          text: JSON.stringify(publicMcpTools(), null, 2),
        },
      ],
    };
  }
  throw new Error(`ORDINE resource is not readable: ${value}`);
};
