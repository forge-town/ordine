import { describe, expect, it } from "vitest";
import { buildClaudeMcpInjection, sanitizeServerKey } from "./buildClaudeMcpInjection";

const connected = (name: string, config: unknown, status = "connected", method = "mcp") =>
  ({ name, method, status, config }) as never;

describe("sanitizeServerKey", () => {
  it("keeps word chars, replaces the rest", () => {
    expect(sanitizeServerKey("GitHub MCP!")).toBe("GitHub_MCP");
    expect(sanitizeServerKey("###")).toBe("server");
  });
});

describe("buildClaudeMcpInjection", () => {
  it("returns null when there are no connected mcp connectors", () => {
    expect(buildClaudeMcpInjection([])).toBeNull();
    expect(
      buildClaudeMcpInjection([
        connected("fs", { transport: "stdio", command: "x" }, "needs_setup"),
      ]),
    ).toBeNull();
    expect(buildClaudeMcpInjection([connected("legacy", {})])).toBeNull();
  });

  it("skips non-mcp connectors even when they look connected", () => {
    expect(
      buildClaudeMcpInjection([
        connected("api", { transport: "stdio", command: "x" }, "connected", "direct-api"),
        connected("builtin", { transport: "stdio", command: "y" }, "connected", "built-in"),
      ]),
    ).toBeNull();
  });

  it("builds stdio server entry + per-tool allow names", () => {
    const out = buildClaudeMcpInjection([
      connected("fs", {
        transport: "stdio",
        command: "npx",
        args: ["-y", "server-fs"],
        env: { TOKEN: "x" },
        tools: [{ name: "read_file" }, { name: "write_file" }],
      }),
    ]);
    expect(out).not.toBeNull();
    expect(out!.mcpServers.fs).toEqual({
      command: "npx",
      args: ["-y", "server-fs"],
      env: { TOKEN: "x" },
    });
    expect(out!.toolNames).toEqual(["mcp__fs__read_file", "mcp__fs__write_file"]);
  });

  it("builds http entry and whole-server allow when no tools discovered", () => {
    const out = buildClaudeMcpInjection([
      connected("remote api", { transport: "http", url: "https://x/sse" }),
    ]);
    expect(out!.mcpServers.remote_api).toEqual({ type: "http", url: "https://x/sse" });
    expect(out!.toolNames).toEqual(["mcp__remote_api"]);
  });

  it("dedupes server keys with the same sanitized name", () => {
    const out = buildClaudeMcpInjection([
      connected("api x", { transport: "stdio", command: "a" }),
      connected("api!x", { transport: "stdio", command: "b" }),
    ]);
    expect(Object.keys(out!.mcpServers).sort()).toEqual(["api_x", "api_x_"]);
  });
});
