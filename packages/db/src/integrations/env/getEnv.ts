import { envSchema } from "./envSchema";

export const getEnv = () => {
  const { error, data } = envSchema.safeParse(process.env);
  if (error) {
    throw new Error(`DB env not valid. Message is: ${JSON.stringify(error.issues, null, 2)}`);
  }

  return data;
};
