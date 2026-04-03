import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { timestamp, text, pgTable, jsonb } from "drizzle-orm/pg-core";

// ─── Operations Table (mirrors apps/app/src/models/tables/operations_table.ts) ─

export const OBJECT_TYPES = ["file", "folder", "project"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const operationsTable = pgTable("operations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  config: text("config").notNull().default("{}"),
  acceptedObjectTypes: jsonb("accepted_object_types")
    .notNull()
    .default(["file", "folder", "project"]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewOperationRow = typeof operationsTable.$inferInsert;

// ─── DB Connection ────────────────────────────────────────────────────────────

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(databaseUrl);
export const db = drizzle(client, { schema: { operationsTable } });
export { client };
