import { z } from "zod/v4";

export const envSchema = z.object({
  ORDINE_API_URL: z.string().default("http://localhost:9430"),
});

export type Env = z.infer<typeof envSchema>;
