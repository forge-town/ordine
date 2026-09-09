import { readFile } from "node:fs/promises";
import { auth } from "@/integrations/better-auth";
import { getServerEnv } from "@/integrations/server-env";
import { createExecutionSessionProxy } from "./executionSessionProxy";

export const proxyExecutionApiRequest = (request: Request) => {
  const env = getServerEnv();

  return createExecutionSessionProxy({
    origin: new URL(env.VITE_APP_URL).origin,
    target: env.ORDINE_EXECUTION_API_TARGET,
    transport: env.ORDINE_EXECUTION_AUTH_MODE,
    ownerUserId: env.ORDINE_EXECUTION_OWNER_USER_ID,
    getSessionUserId: async (input) =>
      (await auth.api.getSession({ headers: input.headers }))?.user.id ?? null,
    readToken: async () => {
      if (!env.ORDINE_EXECUTION_APP_TOKEN_FILE) throw new Error("App credential is not configured");

      return readFile(env.ORDINE_EXECUTION_APP_TOKEN_FILE, "utf8");
    },
  })(request);
};
