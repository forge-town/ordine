import { clientEnvSchema } from "./envSchema";

export const getClientEnv = () => {
  const parsed = clientEnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    console.error("Invalid client environment variables:", parsed.error.issues);
    throw new Error("Invalid client environment variables");
  }
  return parsed.data;
};
