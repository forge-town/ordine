import { z } from "zod/v4";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";

export const CapabilityCatalogKindSchema = z.enum(["builtin-tool", "skill", "mcp-tool"]);
export type CapabilityCatalogKind = z.infer<typeof CapabilityCatalogKindSchema>;

export const CapabilityCatalogSourceSchema = z.enum(["builtin", "manual", "scanned"]);
export type CapabilityCatalogSource = z.infer<typeof CapabilityCatalogSourceSchema>;

export const CapabilityRiskTierSchema = z.enum(["readonly", "write", "irreversible"]);
export type CapabilityRiskTier = z.infer<typeof CapabilityRiskTierSchema>;

export const CapabilityRiskSourceSchema = z.enum(["rule", "override"]);
export type CapabilityRiskSource = z.infer<typeof CapabilityRiskSourceSchema>;

const CapabilityCatalogEntryBaseSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  source: CapabilityCatalogSourceSchema,
  supportedRuntimes: z.array(AgentRuntimeSchema),
  riskTier: CapabilityRiskTierSchema,
  inferredRiskTier: CapabilityRiskTierSchema,
  riskTierSource: CapabilityRiskSourceSchema,
});

export const CapabilityCatalogEntrySchema = z.discriminatedUnion("kind", [
  CapabilityCatalogEntryBaseSchema.extend({
    kind: z.literal("builtin-tool"),
  }),
  CapabilityCatalogEntryBaseSchema.extend({
    kind: z.literal("skill"),
    skillId: z.string().min(1),
  }),
  CapabilityCatalogEntryBaseSchema.extend({
    kind: z.literal("mcp-tool"),
    connectorId: z.string().min(1),
  }),
]);
export type CapabilityCatalogEntry = z.infer<typeof CapabilityCatalogEntrySchema>;

export const GetCapabilityCatalogInputSchema = z.object({
  runtime: AgentRuntimeSchema.optional(),
  kinds: z.array(CapabilityCatalogKindSchema).optional(),
});
export type GetCapabilityCatalogInput = z.infer<typeof GetCapabilityCatalogInputSchema>;

export const SetCapabilityRiskTierOverrideInputSchema = z.object({
  id: z.string().min(1),
  riskTier: CapabilityRiskTierSchema.nullable(),
});
export type SetCapabilityRiskTierOverrideInput = z.infer<
  typeof SetCapabilityRiskTierOverrideInputSchema
>;

export const CapabilityCatalogValidationIssueSchema = z.object({
  path: z.string().min(1),
  reference: z.string().min(1),
  expectedKinds: z.array(CapabilityCatalogKindSchema).min(1),
  runtime: AgentRuntimeSchema.optional(),
});
export type CapabilityCatalogValidationIssue = z.infer<
  typeof CapabilityCatalogValidationIssueSchema
>;
