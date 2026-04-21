import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";

export type DbConnection = PostgresJsDatabase<Record<string, unknown>>;

export type DbExecutor =
  | DbConnection
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;
