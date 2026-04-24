import { z } from "zod/v4";

export const envSchema = z.object({
  PORT: z.coerce.number().optional(),
  JOB_TIMEOUT_MS: z.coerce.number().optional(),
});

export type Env = z.infer<typeof envSchema>;
