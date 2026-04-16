import pino from "pino";

export const logger = pino({
  name: "ordine",
  level: process.env.LOG_LEVEL ?? "info",
});
