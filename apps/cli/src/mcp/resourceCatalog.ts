import { z } from "zod";
import type { McpPolicy } from "./policy";
import { publicMcpTools, type McpApiClient } from "./toolCatalog";

export const McpResourceUriSchema = z.enum([
  "ordine://workspace/context",
  "ordine://catalog/tools",
  "ordine://api/pipelines",
  "ordine://api/skills",
  "ordine://api/operations",
  "ordine://api/jobs",
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
  {
    uri: "ordine://api/pipelines",
    name: "ordine-pipelines",
    title: "ORDINE pipelines",
    description: "Live pipeline catalog from the ORDINE API.",
    mimeType: "application/json",
  },
  {
    uri: "ordine://api/skills",
    name: "ordine-skills",
    title: "ORDINE skills",
    description: "Live skill catalog from the ORDINE API.",
    mimeType: "application/json",
  },
  {
    uri: "ordine://api/operations",
    name: "ordine-operations",
    title: "ORDINE operations",
    description: "Live operation catalog from the ORDINE API.",
    mimeType: "application/json",
  },
  {
    uri: "ordine://api/jobs",
    name: "ordine-jobs",
    title: "ORDINE jobs",
    description: "Live job catalog from the ORDINE API.",
    mimeType: "application/json",
  },
] as const;

const apiPathByUri: Partial<Record<McpResourceUri, string>> = {
  "ordine://api/pipelines": "/api/pipelines",
  "ordine://api/skills": "/api/skills",
  "ordine://api/operations": "/api/operations",
  "ordine://api/jobs": "/api/jobs",
};

export const publicMcpResources = () => resources.map((resource) => ({ ...resource }));

export const readMcpResource = async ({
  uri,
  policy,
  apiClient,
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
              cwd: process.cwd(),
              apiUrl: process.env.ORDINE_API_URL ?? "http://localhost:9433",
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
  const path = apiPathByUri[value];
  if (!path) throw new Error(`ORDINE resource is not readable: ${value}`);
  const response = await apiClient.get(path);
  if (!response.ok) {
    throw new Error(`Failed to read ${value}: ${response.status} ${response.message}`);
  }

  return {
    contents: [
      {
        uri: value,
        mimeType: "application/json",
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
};
