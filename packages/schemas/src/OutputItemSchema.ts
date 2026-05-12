import { z } from "zod/v4";
import { PortKindSchema } from "./PortKindSchema";

export const OutputItemSchema = z.object({
  name: z.string(),
  kind: PortKindSchema,
  description: z.string().optional(),
  templateIds: z.array(z.string()).default([]),
});
export type OutputItem = z.infer<typeof OutputItemSchema>;
