import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@ordine/db-schema";

type DbSchema = typeof schema;

let _db: PostgresJsDatabase<DbSchema> | null = null;

export const db = new Proxy({} as PostgresJsDatabase<DbSchema>, {
  get(_target, prop, receiver) {
    if (!_db) {
      const connectionString = process.env["DATABASE_URL"];
      if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is not set");
      }
      const client = postgres(connectionString);
      _db = drizzle(client, { schema: { ...schema } });
    }
    return Reflect.get(_db, prop, receiver);
  },
});
