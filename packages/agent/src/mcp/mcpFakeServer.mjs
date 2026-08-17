// Test fixture: a minimal fake MCP server over stdio (newline-delimited JSON-RPC).
// Responds to `initialize` and `tools/list`; ignores notifications. Used by mcpStdioClient.unit.test.ts.
//
// Behaviour is selected via MCP_FAKE_MODE so a single fixture can exercise every
// tools/list path:
//   default    → two tools in one page (no cursor)
//   paginated  → page 1 (read_file, nextCursor) then page 2 (write_file)
//   empty      → a valid empty list (tools: [])
//   malformed  → a result object with no `tools` array
//   cursorloop → always returns the same nextCursor (misbehaving server)
import { Result } from "neverthrow";

const MODE = process.env.MCP_FAKE_MODE ?? "default";

// neverthrow-wrapped JSON.parse: non-JSON lines take the isErr branch and are
// skipped — no bare try/catch (same pattern as mcpStdioClient).
const safeJsonParse = Result.fromThrowable(
  (line) => JSON.parse(line),
  () => "non-JSON line",
);

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);

const EMPTY_INPUT_SCHEMA = { type: "object", properties: {} };
const READ_FILE = {
  name: "read_file",
  description: "Read a file",
  inputSchema: EMPTY_INPUT_SCHEMA,
};
const WRITE_FILE = { name: "write_file", inputSchema: EMPTY_INPUT_SCHEMA };

const toolsListResult = (id, cursor) => {
  if (MODE === "malformed") return { jsonrpc: "2.0", id, result: {} };
  if (MODE === "empty") return { jsonrpc: "2.0", id, result: { tools: [] } };
  if (MODE === "cursorloop") {
    return { jsonrpc: "2.0", id, result: { tools: [READ_FILE], nextCursor: "loop" } };
  }
  if (MODE === "paginated") {
    return cursor === "page2"
      ? { jsonrpc: "2.0", id, result: { tools: [WRITE_FILE] } }
      : { jsonrpc: "2.0", id, result: { tools: [READ_FILE], nextCursor: "page2" } };
  }

  return { jsonrpc: "2.0", id, result: { tools: [READ_FILE, WRITE_FILE] } };
};

const state = { buffer: "" };
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  state.buffer += chunk;
  const lines = state.buffer.split("\n");
  state.buffer = lines.pop() ?? "";
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parsed = safeJsonParse(line);
    if (parsed.isErr()) continue;
    const msg = parsed.value;
    if (msg.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          serverInfo: { name: "fake", version: "1.0.0" },
        },
      });
    } else if (msg.method === "tools/list") {
      send(toolsListResult(msg.id, msg.params?.cursor));
    }
    // notifications/initialized: ignore
  }
});
