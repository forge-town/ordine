import { z } from "zod/v4";

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string(),
  VITE_APP_URL: z.string().default("http://localhost:9430"),
  BETTER_AUTH_SECRET: z.string(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
