import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@repo/db-schema";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const client = postgres(connectionString);

export const db = drizzle(client, {
  schema: { ...schema },
});
