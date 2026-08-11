import { z } from "zod/v4";

export const envSchema = z.object({
  ORDINE_API_URL: z.string().default("http://localhost:9433"),
  ORDINE_DESKTOP_AUTH_TOKEN: z.string().min(32).optional(),
});

export type Env = z.infer<typeof envSchema>;
