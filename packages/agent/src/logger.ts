import pino from "pino";

export const logger = pino({
  name: "agent",
  level: process.env.LOG_LEVEL ?? "info",
});
