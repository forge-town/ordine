import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const toolNames = JSON.parse(process.env.ORDINE_DOCTOR_FIXTURE_TOOLS ?? "[]");
const workspaceContextText =
  process.env.ORDINE_DOCTOR_FIXTURE_CONTEXT ??
  JSON.stringify({
    policy: { mode: "safe", allowWrite: true, allowIrreversible: false },
  });

const server = new Server(
  { name: "ordine-doctor-fixture", version: "1.0.0" },
  {
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false, subscribe: false },
    },
  },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolNames.map((name) => ({
    name,
    description: "Fixture call",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  })),
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [{ type: "text", text: request.params.name === "ordine.search" ? "[]" : "bad" }],
  isError: request.params.name !== "ordine.search",
}));
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "ordine://workspace/context",
      name: "ordine-workspace-context",
      mimeType: "application/json",
    },
  ],
}));
server.setRequestHandler(ReadResourceRequestSchema, async () => ({
  contents: [
    {
      uri: "ordine://workspace/context",
      mimeType: "application/json",
      text: workspaceContextText,
    },
  ],
}));
await server.connect(new StdioServerTransport());
