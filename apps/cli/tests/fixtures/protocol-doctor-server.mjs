import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "ordine-doctor-fixture", version: "1.0.0" },
  { capabilities: { tools: { listChanged: false } } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ordine.list_jobs",
      description: "Safe fixture call",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [{ type: "text", text: request.params.name === "ordine.list_jobs" ? "[]" : "bad" }],
  isError: request.params.name !== "ordine.list_jobs",
}));
await server.connect(new StdioServerTransport());
