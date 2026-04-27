import pino from "pino";

import { getEnv } from "./integrations/env";

const env = getEnv();
const isDev = env.NODE_ENV !== "production";

const pinoLogger = pino({
  name: "ordine",
  level: env.LOG_LEVEL ?? "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

export const logger = pinoLogger;
