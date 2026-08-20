import { defineConfig } from "drizzle-kit";
import { getServerEnv } from "./src/integrations/server-env";

const { DATABASE_URL } = getServerEnv();

export default defineConfig({
  schema: "../../packages/db-schema/src/tables/!(*.unit.test).ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
