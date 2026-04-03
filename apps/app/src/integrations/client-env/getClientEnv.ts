import { clientEnvSchema } from "./envSchema";

export const getClientEnv = () => {
  const parsed = clientEnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    throw new Error("Invalid client environment variables");
  }
  return parsed.data;
};
