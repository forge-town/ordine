import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@ordine/db-schema";

// Re-export all schema tables and types for seed scripts
export * from "@ordine/db-schema";

// ─── DB Connection ────────────────────────────────────────────────────────────

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(databaseUrl);
export const db = drizzle(client, {
  schema: { ...schema },
});
export { client };
