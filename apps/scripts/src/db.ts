import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@repo/db-schema";

// Re-export all schema for seed scripts
export * from "@repo/db-schema";

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
