import { z } from "zod/v4";

export const envSchema = z.object({
  PORT: z.coerce.number().optional(),
  JOB_TIMEOUT_MS: z.coerce.number().optional(),
  ORDINE_AGENT_API_TOKEN: z.string().min(32).optional(),
});

export type Env = z.infer<typeof envSchema>;
