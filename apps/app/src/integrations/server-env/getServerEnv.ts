import { serverEnvSchema } from "./envSchema";

export const getServerEnv = () => {
  const { error, data } = serverEnvSchema.safeParse(process.env);
  if (error) {
    throw new Error(`Server env not valid: ${JSON.stringify(error.issues, null, 2)}`);
  }

  if (data.ORDINE_LOCAL_MODE && data.NODE_ENV === "production" && !data.ORDINE_SELF_HOSTED) {
    throw new Error(
      "ORDINE_LOCAL_MODE=true is not allowed in production. " +
        "Set ORDINE_SELF_HOSTED=true only for a self-hosted single-machine deployment. " +
        "Do NOT enable in shared / production environments.",
    );
  }

  return data;
};
