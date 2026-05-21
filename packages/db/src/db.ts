import postgres from "postgres";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@repo/db-schema";

import { getEnv } from "./integrations/env";

const { DATABASE_URL, PGLITE_DATA_DIR } = getEnv();

const createDb = async (): Promise<PostgresJsDatabase<Record<string, unknown>>> => {
  if (PGLITE_DATA_DIR) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const client = new PGlite(PGLITE_DATA_DIR);

    return drizzlePglite(client, { schema: { ...schema } }) as unknown as PostgresJsDatabase<
      Record<string, unknown>
    >;
  }

  const client = postgres(DATABASE_URL!);

  return drizzlePg(client, { schema: { ...schema } });
};

export const db = await createDb();
