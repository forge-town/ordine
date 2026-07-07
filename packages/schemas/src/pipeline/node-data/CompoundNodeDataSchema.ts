import { z } from "zod/v4";
import { PipelineEdgeSchema } from "../edge/PipelineEdgeSchema";

export const COMPOUND_KIND_ENUM = {
  VERIFY: "verify",
  COUNCIL: "council",
  DELEGATION: "delegation",
  CUSTOM: "custom",
} as const;
export const CompoundKindSchema = z.enum(COMPOUND_KIND_ENUM);
export type CompoundKind = z.infer<typeof CompoundKindSchema>;

export const VerifyConfigSchema = z.object({
  maxRounds: z.number().int().min(1).default(3),
  criteria: z.string(),
});
export type VerifyConfig = z.infer<typeof VerifyConfigSchema>;

export const CouncilConfigSchema = z.object({
  roles: z.array(
    z.object({
      name: z.string(),
      perspective: z.string(),
      agentId: z.string().optional(),
    }),
  ),
  convergenceCondition: z.string(),
});
export type CouncilConfig = z.infer<typeof CouncilConfigSchema>;

export const DelegationConfigSchema = z.object({
  splitStrategy: z.string(),
  mergeStrategy: z.string(),
});
export type DelegationConfig = z.infer<typeof DelegationConfigSchema>;

/**
 * `compoundKind` / `childEdges` carry defaults so legacy data persisted as
 * `{ label, nodeType, childNodeIds, description? }` keeps deserializing.
 */
export const CompoundNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("compound"),
  compoundKind: CompoundKindSchema.default("custom"),
  childNodeIds: z.array(z.string()),
  childEdges: z.array(PipelineEdgeSchema).default([]),
  description: z.string().optional(),
  verifyConfig: VerifyConfigSchema.optional(),
  councilConfig: CouncilConfigSchema.optional(),
  delegationConfig: DelegationConfigSchema.optional(),
});
export type CompoundNodeData = z.infer<typeof CompoundNodeDataSchema>;
