import { describe, expect, it } from "vitest";
import {
  buildMcpConnectorInjection,
  resolveMcpConnectorTools,
  sanitizeServerKey,
} from "./buildClaudeMcpInjection";

const connected = (
  name: string,
  config: unknown,
  status = "connected",
  method = "mcp",
  id = `connector-${name}`,
) => ({ id, name, method, status, config }) as never;

describe("sanitizeServerKey", () => {
  it("keeps word chars, replaces the rest", () => {
    expect(sanitizeServerKey("GitHub MCP!")).toBe("GitHub_MCP");
    expect(sanitizeServerKey("###")).toBe("server");
  });
});

describe("buildMcpConnectorInjection", () => {
  it("returns null when there are no connected mcp connectors", () => {
    expect(buildMcpConnectorInjection([])).toBeNull();
    expect(
      buildMcpConnectorInjection([
        connected("fs", { transport: "stdio", command: "x" }, "needs_setup"),
      ]),
    ).toBeNull();
    expect(buildMcpConnectorInjection([connected("legacy", {})])).toBeNull();
  });

  it("skips non-mcp connectors even when they look connected", () => {
    expect(
      buildMcpConnectorInjection([
        connected("api", { transport: "stdio", command: "x" }, "connected", "direct-api"),
        connected("builtin", { transport: "stdio", command: "y" }, "connected", "built-in"),
      ]),
    ).toBeNull();
  });

  it("builds stdio server entry + per-tool allow names", () => {
    const out = buildMcpConnectorInjection([
      connected("fs", {
        transport: "stdio",
        command: "npx",
        args: ["-y", "server-fs"],
        cwd: "/workspace",
        env: { TOKEN: "x" },
        tools: [{ name: "read_file" }, { name: "write_file" }],
      }),
    ]);
    expect(out).not.toBeNull();
    expect(out!.mcpServers.fs).toEqual({
      command: "npx",
      args: ["-y", "server-fs"],
      cwd: "/workspace",
      env: { TOKEN: "x" },
    });
    expect(out!.toolNames).toEqual(["mcp__fs__read_file", "mcp__fs__write_file"]);
  });

  it("builds http entry and whole-server allow when no tools discovered", () => {
    const out = buildMcpConnectorInjection([
      connected("remote api", { transport: "http", url: "https://x/sse" }),
    ]);
    expect(out!.mcpServers.remote_api).toEqual({ type: "http", url: "https://x/sse" });
    expect(out!.toolNames).toEqual(["mcp__remote_api"]);
  });

  it("dedupes server keys with the same sanitized name", () => {
    const out = buildMcpConnectorInjection([
      connected("api x", { transport: "stdio", command: "a" }),
      connected("api!x", { transport: "stdio", command: "b" }),
    ]);
    expect(Object.keys(out!.mcpServers).sort()).toEqual(["api_x", "api_x_"]);
  });

  it("only includes connectors selected for the current run", () => {
    const out = buildMcpConnectorInjection(
      [
        connected("github", {
          transport: "stdio",
          command: "github-mcp",
          tools: [{ name: "create_issue" }, { name: "read_issue" }],
        }),
        connected("linear", {
          transport: "http",
          url: "https://mcp.linear.app/mcp",
          tools: [{ name: "create_issue" }],
        }),
      ],
      ["mcp__github__read_issue"],
    );

    expect(out).toEqual({
      mcpServers: { github: { command: "github-mcp" } },
      toolNames: ["mcp__github__read_issue"],
    });
  });

  it("uses connector id order for stable deduped keys", () => {
    const connectors = [
      connected(
        "api",
        { transport: "stdio", command: "second-mcp", tools: [{ name: "read" }] },
        "connected",
        "mcp",
        "connector-b",
      ),
      connected(
        "api",
        { transport: "stdio", command: "first-mcp", tools: [{ name: "read" }] },
        "connected",
        "mcp",
        "connector-a",
      ),
    ];

    for (const orderedConnectors of [connectors, [...connectors].reverse()]) {
      expect(buildMcpConnectorInjection(orderedConnectors, ["mcp__api___read"])).toEqual({
        mcpServers: { api_: { command: "second-mcp" } },
        toolNames: ["mcp__api___read"],
      });
    }
  });

  it("fails closed when a selected tool name maps to multiple servers", () => {
    expect(() =>
      buildMcpConnectorInjection(
        [
          connected("api x", {
            transport: "stdio",
            command: "first-mcp",
            tools: [{ name: "_read" }],
          }),
          connected("api!x", {
            transport: "stdio",
            command: "second-mcp",
            tools: [{ name: "read" }],
          }),
        ],
        ["mcp__api_x___read"],
      ),
    ).toThrow("Ambiguous MCP tool selection mcp__api_x___read");
  });
});

describe("resolveMcpConnectorTools", () => {
  it("uses the exact runtime references and stable connector-name disambiguation", () => {
    const connectors = [
      connected(
        "github",
        {
          transport: "stdio",
          command: "github-second",
          tools: [{ name: "create_issue", description: "Create an issue" }],
        },
        "connected",
        "mcp",
        "connector-b",
      ),
      connected(
        "github",
        {
          transport: "stdio",
          command: "github-first",
          tools: [{ name: "read_issue" }],
        },
        "connected",
        "mcp",
        "connector-a",
      ),
    ];

    const tools = resolveMcpConnectorTools(connectors);
    expect(tools.map((tool) => tool.reference)).toEqual([
      "mcp__github__read_issue",
      "mcp__github___create_issue",
    ]);
    expect(
      buildMcpConnectorInjection(
        connectors,
        tools.map((tool) => tool.reference),
      )?.toolNames,
    ).toEqual(tools.map((tool) => tool.reference));
  });

  it("excludes disconnected, invalid, and tool-less connectors", () => {
    expect(
      resolveMcpConnectorTools([
        connected(
          "pending",
          { transport: "stdio", command: "x", tools: [{ name: "read" }] },
          "needs_setup",
        ),
        connected("invalid", { transport: "stdio", tools: [{ name: "read" }] }),
        connected("empty", { transport: "stdio", command: "x" }),
      ]),
    ).toEqual([]);
  });
});
