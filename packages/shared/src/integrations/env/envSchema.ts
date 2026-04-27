import { z } from "zod/v4";

export const envSchema = z.object({
  NODE_ENV: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
