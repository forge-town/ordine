// Test fixture: a minimal fake MCP server over stdio (newline-delimited JSON-RPC).
// Responds to `initialize` and `tools/list`; ignores notifications. Used by mcpStdioClient.unit.test.ts.
import { Result } from "neverthrow";

// neverthrow-wrapped JSON.parse: non-JSON lines take the isErr branch and are
// skipped — no bare try/catch (same pattern as mcpStdioClient).
const safeJsonParse = Result.fromThrowable(
  (line) => JSON.parse(line),
  () => "non-JSON line",
);

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
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "fake", version: "1.0.0" } } })}\n`,
      );
    } else if (msg.method === "tools/list") {
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "read_file", description: "Read a file" }, { name: "write_file" }] } })}\n`,
      );
    }
    // notifications/initialized: ignore
  }
});
