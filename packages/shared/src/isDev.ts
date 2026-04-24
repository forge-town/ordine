import { getEnv } from "./integrations/env";

export const isDev = getEnv().NODE_ENV !== "production";
