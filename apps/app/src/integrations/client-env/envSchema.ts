import { z } from "zod";

export const clientEnvSchema = z.object({
  VITE_APP_URL: z.string().default("http://localhost:3001"),
  VITE_MASTRA_API_URL: z.string().default("http://localhost:4111"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
