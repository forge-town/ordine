import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";

export type DbExecutor =
  | PostgresJsDatabase<Record<string, unknown>>
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;
