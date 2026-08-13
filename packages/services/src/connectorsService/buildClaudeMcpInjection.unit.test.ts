import { describe, expect, it } from "vitest";
import {
  buildMcpConnectorInjection,
  buildMcpServerKey,
  buildMcpToolReference,
  resolveMcpConnectorTools,
} from "./buildClaudeMcpInjection";

const connected = (
  name: string,
  config: unknown,
  status = "connected",
  method = "mcp",
  id = `connector-${name}`,
) => ({ id, name, method, status, config }) as never;

const toolReference = (connectorId: string, toolName: string): string =>
  buildMcpToolReference(buildMcpServerKey(connectorId), toolName);

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
    const connectorId = "connector-fs";
    const serverKey = buildMcpServerKey(connectorId);
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
    expect(out!.mcpServers[serverKey]).toEqual({
      command: "npx",
      args: ["-y", "server-fs"],
      cwd: "/workspace",
      env: { TOKEN: "x" },
    });
    expect(out!.toolNames).toEqual([
      toolReference(connectorId, "read_file"),
      toolReference(connectorId, "write_file"),
    ]);
  });

  it("builds http entry and whole-server allow when no tools discovered", () => {
    const connectorId = "connector-remote api";
    const serverKey = buildMcpServerKey(connectorId);
    const out = buildMcpConnectorInjection([
      connected("remote api", { transport: "http", url: "https://x/sse" }),
    ]);
    expect(out!.mcpServers[serverKey]).toEqual({ type: "http", url: "https://x/sse" });
    expect(out!.toolNames).toEqual([`mcp__${serverKey}`]);
  });

  it("uses stable connector ids when display names collide", () => {
    const out = buildMcpConnectorInjection([
      connected("api", { transport: "stdio", command: "a" }, "connected", "mcp", "a"),
      connected("api", { transport: "stdio", command: "b" }, "connected", "mcp", "b"),
    ]);
    expect(Object.keys(out!.mcpServers).sort()).toEqual(
      [buildMcpServerKey("a"), buildMcpServerKey("b")].sort(),
    );
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
      [toolReference("connector-github", "read_issue")],
    );

    expect(out).toEqual({
      mcpServers: { [buildMcpServerKey("connector-github")]: { command: "github-mcp" } },
      toolNames: [toolReference("connector-github", "read_issue")],
    });
  });

  it("does not drift an existing reference when a same-name connector is added", () => {
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
    const existingReference = toolReference("connector-b", "read");

    for (const orderedConnectors of [
      connectors.slice(0, 1),
      connectors,
      [...connectors].reverse(),
    ]) {
      expect(buildMcpConnectorInjection(orderedConnectors, [existingReference])).toEqual({
        mcpServers: {
          [buildMcpServerKey("connector-b")]: { command: "second-mcp" },
        },
        toolNames: [existingReference],
      });
    }
  });

  it("keeps formerly ambiguous connector/tool pairs unique at runtime", () => {
    const first = connected(
      "api x",
      { transport: "stdio", command: "first-mcp", tools: [{ name: "_read" }] },
      "connected",
      "mcp",
      "connector-a",
    );
    const second = connected(
      "api!x",
      { transport: "stdio", command: "second-mcp", tools: [{ name: "read" }] },
      "connected",
      "mcp",
      "connector-b",
    );
    const references = [
      toolReference("connector-a", "_read"),
      toolReference("connector-b", "read"),
    ];

    expect(new Set(references).size).toBe(2);
    expect(buildMcpConnectorInjection([first, second], references)).toEqual({
      mcpServers: {
        [buildMcpServerKey("connector-a")]: { command: "first-mcp" },
        [buildMcpServerKey("connector-b")]: { command: "second-mcp" },
      },
      toolNames: references,
    });
  });
});

describe("resolveMcpConnectorTools", () => {
  it("uses the exact runtime references and stable connector identity", () => {
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
      toolReference("connector-a", "read_issue"),
      toolReference("connector-b", "create_issue"),
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
