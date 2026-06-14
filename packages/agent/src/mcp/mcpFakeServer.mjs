// Test fixture: a minimal fake MCP server over stdio (newline-delimited JSON-RPC).
// Responds to `initialize` and `tools/list`; ignores notifications. Used by mcpStdioClient.unit.test.ts.
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl = buffer.indexOf("\n");
  while (nl !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    nl = buffer.indexOf("\n");
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
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
