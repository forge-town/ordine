import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const pinoLogger = pino({
  name: "ordine",
  level: process.env.LOG_LEVEL ?? "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

export const logger = pinoLogger;
