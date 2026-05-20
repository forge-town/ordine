import postgres from "postgres";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@repo/db-schema";

import { getEnv } from "./integrations/env";

const { DATABASE_URL, PGLITE_DATA_DIR } = getEnv();

const createDb = async (): Promise<PostgresJsDatabase<Record<string, unknown>>> => {
  if (PGLITE_DATA_DIR) {
    const pglitePkg = "@electric-sql/pglite";
    const drizzlePglitePkg = "drizzle-orm/pglite";
    const { PGlite } = await import(/* @vite-ignore */ pglitePkg);
    const { drizzle: drizzlePglite } = await import(/* @vite-ignore */ drizzlePglitePkg);
    const client = new PGlite(PGLITE_DATA_DIR);

    return drizzlePglite(client, { schema: { ...schema } }) as unknown as PostgresJsDatabase<Record<string, unknown>>;
  }

  const client = postgres(DATABASE_URL!);

  return drizzlePg(client, { schema: { ...schema } });
};

export const db = await createDb();
