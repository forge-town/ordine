import { z } from "zod/v4";

export const MetaSchema = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Meta = z.infer<typeof MetaSchema>;
