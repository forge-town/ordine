import { z } from "zod/v4";
import { PortKindSchema } from "./PortKindSchema";

export const InputPortSchema = z.object({
  name: z.string(),
  kind: PortKindSchema,
  required: z.boolean(),
  description: z.string().optional(),
});
export type InputPort = z.infer<typeof InputPortSchema>;
