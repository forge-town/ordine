import { z } from "zod/v4";

export const envSchema = z.object({
  API_BASE_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
