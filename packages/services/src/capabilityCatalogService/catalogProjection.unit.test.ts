import { describe, expect, it } from "vitest";
import { buildMcpConnectorInjection } from "../connectorsService/buildClaudeMcpInjection";
import {
  projectCapabilityCatalog,
  type CatalogConnector,
  type CatalogSkill,
} from "./catalogProjection";

const connector = (
  id: string,
  name: string,
  config: CatalogConnector["config"],
  status = "connected",
): CatalogConnector => ({
  id,
  name,
  method: "mcp",
  status,
  config,
  origin: "harvested",
});

const skill = (id: string, origin: CatalogSkill["origin"]): CatalogSkill => ({
  id,
  name: `${id}-skill`,
  label: `${id} skill`,
  description: `${id} description`,
  origin,
  sources: [],
});

describe("projectCapabilityCatalog", () => {
  it("projects builtin, manual/scanned/builtin skills, and connected concrete MCP tools", () => {
    const entries = projectCapabilityCatalog({
      connectors: [
        connector("connector-a", "github", {
          transport: "stdio",
          command: "github-first",
          tools: [{ name: "read_issue", description: "Read an issue" }],
        }),
        connector("connector-b", "github", {
          transport: "stdio",
          command: "github-second",
          tools: [{ name: "create_issue" }],
        }),
        connector(
          "connector-c",
          "offline",
          {
            transport: "stdio",
            command: "offline",
            tools: [{ name: "delete_issue" }],
          },
          "needs_setup",
        ),
        connector("connector-d", "empty", { transport: "stdio", command: "empty" }),
      ],
      skills: [skill("manual", "manual"), skill("scanned", "harvested"), skill("seed", "builtin")],
      overrides: [],
    });

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "builtin:Read",
          kind: "builtin-tool",
          source: "builtin",
          reference: "Read",
          riskTier: "readonly",
        }),
        expect.objectContaining({ id: "skill:manual", kind: "skill", source: "manual" }),
        expect.objectContaining({ id: "skill:scanned", kind: "skill", source: "scanned" }),
        expect.objectContaining({ id: "skill:seed", kind: "skill", source: "builtin" }),
        expect.objectContaining({
          id: "mcp:connector-a:read_issue",
          kind: "mcp-tool",
          reference: "mcp__github__read_issue",
          riskTier: "readonly",
        }),
        expect.objectContaining({
          id: "mcp:connector-b:create_issue",
          reference: "mcp__github___create_issue",
          riskTier: "write",
        }),
      ]),
    );
    expect(entries.some((entry) => entry.id.includes("connector-c"))).toBe(false);
    expect(entries.some((entry) => entry.id.includes("connector-d"))).toBe(false);

    const mcpReferences = entries
      .filter((entry) => entry.kind === "mcp-tool")
      .map((entry) => entry.reference);
    expect(
      buildMcpConnectorInjection(
        [
          connector("connector-a", "github", {
            transport: "stdio",
            command: "github-first",
            tools: [{ name: "read_issue" }],
          }),
          connector("connector-b", "github", {
            transport: "stdio",
            command: "github-second",
            tools: [{ name: "create_issue" }],
          }),
        ],
        mcpReferences,
      )?.toolNames,
    ).toEqual(mcpReferences);
  });

  it("applies a risk override while preserving the inferred tier", () => {
    const entries = projectCapabilityCatalog({
      connectors: [],
      skills: [],
      overrides: [{ capabilityId: "builtin:Read", riskTier: "irreversible" }],
    });

    expect(entries.find((entry) => entry.id === "builtin:Read")).toMatchObject({
      inferredRiskTier: "readonly",
      riskTier: "irreversible",
      riskTierSource: "override",
    });
  });
});
