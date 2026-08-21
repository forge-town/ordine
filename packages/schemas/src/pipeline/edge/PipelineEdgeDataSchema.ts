import { z } from "zod/v4";
import { DataContractSchema } from "./DataContractSchema";
import { EdgeConditionSchema } from "./EdgeConditionSchema";
import { EdgeQualityGateSchema } from "./EdgeQualityGateSchema";
import { EdgeTransformSchema } from "./EdgeTransformSchema";
import { HandoffEdgeSchema } from "../handoff/HandoffEdgeSchema";

/**
 * Semantic edge payload. Every field beyond `label` is optional so that
 * legacy edges persisted as `{ label }` (or `{}`) keep deserializing.
 */
export const PipelineEdgeDataSchema = z.object({
  label: z.string().default(""),
  dataContract: DataContractSchema.optional(),
  condition: EdgeConditionSchema.optional(),
  transform: EdgeTransformSchema.optional(),
  qualityGate: EdgeQualityGateSchema.optional(),
  /** Semantic file-port binding; omitted on legacy/general-purpose graph edges. */
  handoff: HandoffEdgeSchema.optional(),
});
export type PipelineEdgeData = z.infer<typeof PipelineEdgeDataSchema>;
