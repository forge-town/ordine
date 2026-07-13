import { defineConfig } from "drizzle-kit";
import { getServerEnv } from "./src/integrations/server-env";

const { DATABASE_URL } = getServerEnv();

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for drizzle-kit commands. " +
      "PGlite local mode runs migrations programmatically and does not use drizzle-kit.",
  );
}

export default defineConfig({
  schema: "../../packages/db-schema/src/tables/!(*.unit.test).ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
