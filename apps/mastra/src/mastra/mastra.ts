import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { cors } from "hono/cors";
import { harnessDesignAgent } from "./agents/harness-design-agent.js";
import { harnessValidatorAgent } from "./agents/harness-validator-agent.js";

export const mastra = new Mastra({
  agents: {
    harnessDesignAgent,
    harnessValidatorAgent,
  },
  storage: new LibSQLStore({
    id: "ordine-mastra",
    url: "file:./mastra.db",
  }),
  logger: new PinoLogger({
    name: "OrdineMatstra",
    level: "info",
  }),
  server: {
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
    middleware: [
      cors({
        origin: ["http://localhost:3001", "http://localhost:5173"],
        credentials: true,
      }),
    ],
  },
});
