import { z } from "zod/v4";

export const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  KIMI_API_KEY: z.string().optional(),
});
