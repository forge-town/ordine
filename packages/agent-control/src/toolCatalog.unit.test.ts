import { describe, expect, it } from "vitest";
import {
  AGENT_CONTROL_TOOLS,
  findAgentControlTool,
  listAgentControlTools,
  parseAgentControlToolInput,
  redactAgentControlInput,
  redactAgentControlResult,
  toMcpToolDefinition,
} from ".";

describe("Agent Control tool catalog", () => {
  it("has unique stable names and all five risk classes", () => {
    const names = AGENT_CONTROL_TOOLS.map((tool) => tool.name);

    expect(new Set(names).size).toBe(names.length);
    expect(new Set(AGENT_CONTROL_TOOLS.map((tool) => tool.risk))).toEqual(
      new Set(["read", "draft", "write", "execute", "irreversible"]),
    );
  });

  it("projects public readonly tools from the same catalog", () => {
    const tools = listAgentControlTools({
      audience: "public-readonly",
      scopes: new Set(["resources:read", "canvas:read"]),
    });

    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((tool) => tool.risk === "read")).toBe(true);
    expect(tools.map((tool) => tool.name)).toContain("ordine.inspect_canvas");
    expect(tools.map((tool) => tool.name)).not.toContain("ordine.update_resource");
  });

  it("rejects secret-bearing generic patches", () => {
    expect(() =>
      parseAgentControlToolInput("ordine.update_resource", {
        callId: "call-1",
        resourceType: "connector",
        id: "connector-1",
        patch: { apiKey: "never-store-me" },
      }),
    ).toThrow(/secret values/);
  });

  it("redacts configured paths and secret-shaped keys", () => {
    const definition = findAgentControlTool("ordine.create_resource");
    expect(definition).toBeDefined();
    const redacted = redactAgentControlInput(definition!, {
      callId: "call-1",
      data: {
        config: { headers: { harmless: "value" } },
        nested: { password: "hidden" },
      },
    });

    expect(redacted).toMatchObject({
      data: {
        config: { headers: "[REDACTED]" },
        nested: { password: "[REDACTED]" },
      },
    });
  });

  it("emits MCP JSON Schema from each Zod contract", () => {
    const definition = findAgentControlTool("ordine.add_node");
    expect(definition).toBeDefined();
    const mcpTool = toMcpToolDefinition(definition!);

    expect(mcpTool.inputSchema).toMatchObject({ type: "object" });
    expect(mcpTool.annotations.destructiveHint).toBe(false);
  });

  it("rejects unknown tools and oversized or nested secret patches", () => {
    expect(() => parseAgentControlToolInput("ordine.not_a_tool", {})).toThrow(/Unknown ORDINE/);
    expect(() =>
      parseAgentControlToolInput("ordine.update_resource", {
        callId: "call-2",
        resourceType: "connector",
        id: "connector-1",
        patch: { values: [{ token: "hidden" }] },
      }),
    ).toThrow(/secret values/);
    expect(() =>
      parseAgentControlToolInput("ordine.update_resource", {
        callId: "call-3",
        resourceType: "operation",
        id: "operation-1",
        patch: { content: "x".repeat(33 * 1024) },
      }),
    ).toThrow(/patch exceeds/);
  });

  it("redacts arrays and primitive results without changing harmless values", () => {
    expect(redactAgentControlResult([{ authorization: "Bearer secret" }, "safe", null])).toEqual([
      { authorization: "[REDACTED]" },
      "safe",
      null,
    ]);
    expect(redactAgentControlResult(42)).toBe(42);
  });

  it("redacts credential patterns embedded in ordinary result strings", () => {
    const redacted = redactAgentControlResult({
      message:
        "Authorization: Bearer secret-token-value sk-abcdefghijklmnop github_pat_abcdefghijklmnopqrstuvwxyz123456",
    });

    expect(redacted).toEqual({
      message: "Authorization: Bearer [REDACTED] sk-[REDACTED] github_[REDACTED]",
    });
  });
});
