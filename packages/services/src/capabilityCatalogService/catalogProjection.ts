import { ToolNameSchema } from "@repo/agent";
import type {
  AgentRuntime,
  CapabilityCatalogEntry,
  CapabilityOrigin,
  CapabilityRiskTier,
  CapabilitySource,
  ConnectorConfig,
} from "@repo/schemas";
import { resolveMcpConnectorTools } from "../connectorsService/buildClaudeMcpInjection";
import { inferCapabilityRiskTier } from "./inferCapabilityRiskTier";

export type CatalogConnector = {
  id: string;
  name: string;
  method: string;
  status: string;
  config: ConnectorConfig;
  origin: CapabilityOrigin;
};

export type CatalogSkill = {
  id: string;
  name: string;
  label: string;
  description: string;
  origin: CapabilityOrigin;
  sources: CapabilitySource[];
};

export type CatalogRiskOverride = {
  capabilityId: string;
  riskTier: CapabilityRiskTier;
};

export type CapabilityCatalogProjectionInput = {
  connectors: CatalogConnector[];
  skills: CatalogSkill[];
  overrides: CatalogRiskOverride[];
};

const BUILTIN_SUPPORTED_RUNTIMES = ["claude-code"] as const satisfies readonly AgentRuntime[];
const MCP_SUPPORTED_RUNTIMES = ["claude-code", "codex"] as const satisfies readonly AgentRuntime[];
const SKILL_SUPPORTED_RUNTIMES = [
  "claude-code",
  "codex",
  "mastra",
  "openclaw",
  "pi-agent",
  "opencode",
  "kimi-code",
] as const satisfies readonly AgentRuntime[];

const BUILTIN_RISK_TIERS = {
  Read: "readonly",
  "Bash(find:*)": "readonly",
  "Bash(grep:*)": "readonly",
  "Bash(rg:*)": "readonly",
  "Bash(cat:*)": "readonly",
  "Bash(head:*)": "readonly",
  "Bash(tail:*)": "readonly",
  "Bash(wc:*)": "readonly",
  "Bash(ls:*)": "readonly",
  "Bash(tree:*)": "readonly",
  Edit: "write",
  Write: "write",
  "Bash(sed:*)": "write",
  "Bash(curl:*)": "irreversible",
  "Bash(python3:*)": "irreversible",
  WebSearch: "readonly",
  WebFetch: "readonly",
  "Bash(gh:*)": "irreversible",
} as const satisfies Record<(typeof ToolNameSchema.options)[number], CapabilityRiskTier>;

const toCatalogSource = (origin: CapabilityOrigin): CapabilityCatalogEntry["source"] => {
  if (origin === "builtin") return "builtin";
  if (origin === "harvested") return "scanned";

  return "manual";
};

const withRisk = <T extends Omit<CapabilityCatalogEntry, "riskTier" | "riskTierSource">>(
  entry: T,
  overrideById: ReadonlyMap<string, CapabilityRiskTier>,
): T & Pick<CapabilityCatalogEntry, "riskTier" | "riskTierSource"> => {
  const override = overrideById.get(entry.id);

  return {
    ...entry,
    riskTier: override ?? entry.inferredRiskTier,
    riskTierSource: override ? "override" : "rule",
  };
};

export const projectCapabilityCatalog = ({
  connectors,
  skills,
  overrides,
}: CapabilityCatalogProjectionInput): CapabilityCatalogEntry[] => {
  const overrideById = new Map(
    overrides.map((override) => [override.capabilityId, override.riskTier]),
  );

  const builtinEntries = ToolNameSchema.options.map((reference) => {
    const inferredRiskTier = BUILTIN_RISK_TIERS[reference];

    return withRisk(
      {
        kind: "builtin-tool" as const,
        source: "builtin" as const,
        id: `builtin:${reference}`,
        reference,
        displayName: reference,
        description: `Built-in ${reference} execution tool`,
        supportedRuntimes: [...BUILTIN_SUPPORTED_RUNTIMES],
        inferredRiskTier,
      },
      overrideById,
    );
  });

  const skillEntries = skills.map((skill) => {
    const inferredRiskTier = inferCapabilityRiskTier(`${skill.name} ${skill.label}`);

    return withRisk(
      {
        kind: "skill" as const,
        source: toCatalogSource(skill.origin),
        id: `skill:${skill.id}`,
        reference: skill.id,
        displayName: skill.label,
        description: skill.description,
        supportedRuntimes: [...SKILL_SUPPORTED_RUNTIMES],
        inferredRiskTier,
        skillId: skill.id,
      },
      overrideById,
    );
  });

  const connectorById = new Map(connectors.map((connector) => [connector.id, connector]));
  const mcpEntries = resolveMcpConnectorTools(connectors).map((tool) => {
    const connector = connectorById.get(tool.connector.id)!;
    const inferredRiskTier = inferCapabilityRiskTier(tool.toolName);

    return withRisk(
      {
        kind: "mcp-tool" as const,
        source: toCatalogSource(connector.origin),
        id: `mcp:${tool.connector.id}:${tool.toolName}`,
        reference: tool.reference,
        displayName: tool.toolName,
        description: tool.description,
        supportedRuntimes: [...MCP_SUPPORTED_RUNTIMES],
        inferredRiskTier,
        connectorId: tool.connector.id,
      },
      overrideById,
    );
  });

  return [...builtinEntries, ...skillEntries, ...mcpEntries].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
};
