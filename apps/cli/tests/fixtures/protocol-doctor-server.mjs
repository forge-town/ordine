import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

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
  tools: [
    "ordine.list_pipelines",
    "ordine.create_pipeline",
    "ordine.create_operation",
    "ordine.update_operation",
    "ordine.run_pipeline",
    "ordine.list_jobs",
    "ordine.list_job_traces",
  ].map((name) => ({
    name,
    description: "Fixture call",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  })),
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [{ type: "text", text: request.params.name === "ordine.list_jobs" ? "[]" : "bad" }],
  isError: !["ordine.list_jobs", "ordine.list_pipelines"].includes(request.params.name),
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
      text: JSON.stringify({
        policy: { mode: "safe", allowWrite: true, allowIrreversible: false },
      }),
    },
  ],
}));
await server.connect(new StdioServerTransport());
