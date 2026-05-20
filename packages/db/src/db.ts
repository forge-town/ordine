import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "@repo/db-schema";

import { getEnv } from "./integrations/env";

const { DATABASE_URL, PGLITE_DATA_DIR } = getEnv();

const createDb = (): PostgresJsDatabase<Record<string, unknown>> => {
  if (PGLITE_DATA_DIR) {
    const client = new PGlite(PGLITE_DATA_DIR);

    return drizzlePglite(client, { schema: { ...schema } }) as unknown as PostgresJsDatabase<Record<string, unknown>>;
  }

  const client = postgres(DATABASE_URL!);

  return drizzlePg(client, { schema: { ...schema } });
};

export const db = createDb();
