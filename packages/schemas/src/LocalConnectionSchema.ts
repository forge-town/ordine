import { z } from "zod/v4";

export const LocalConnectionSchema = z.object({
  mode: z.literal("local"),
});

export type LocalConnection = z.infer<typeof LocalConnectionSchema>;
