import { z } from "zod/v4";

export const envSchema = z.object({
  DATABASE_URL: z.string(),
});

export type Env = z.infer<typeof envSchema>;
