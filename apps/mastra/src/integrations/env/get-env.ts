import { z } from "zod";

const envSchema = z.object({
  MASTRA_OPENAI_API_KEY: z.string().optional(),
  MASTRA_OLLAMA_BASE_URL: z.string().default("http://localhost:11434/api"),
});

export const getEnv = () => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid env vars:", parsed.error.issues);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
};

export type Env = z.infer<typeof envSchema>;
