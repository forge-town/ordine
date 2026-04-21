import { z } from "zod/v4";
import { PortKindSchema } from "./PortKindSchema";

export const OutputPortSchema = z.object({
  name: z.string(),
  kind: PortKindSchema,
  path: z.string(),
  description: z.string(),
});
export type OutputPort = z.infer<typeof OutputPortSchema>;
