import { serverEnvSchema } from "./envSchema";

export const getServerEnv = () => {
  const { error, data } = serverEnvSchema.safeParse(process.env);
  if (error) {
    throw new Error(`Server env not valid: ${JSON.stringify(error.issues, null, 2)}`);
  }
  return data;
};
