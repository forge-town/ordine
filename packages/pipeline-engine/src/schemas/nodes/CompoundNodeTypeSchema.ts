import { z } from "zod/v4";

export const CompoundNodeTypeSchema = z.literal("compound");
export type CompoundNodeType = z.infer<typeof CompoundNodeTypeSchema>;
