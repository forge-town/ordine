import { z } from "zod/v4";

export const PipelineAssetInputSlotSchema = z.object({
  nodeId: z.string(),
  label: z.string(),
  acceptTypes: z.array(z.string()).default([]),
});
export type PipelineAssetInputSlot = z.infer<typeof PipelineAssetInputSlotSchema>;
