import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, pgTable } from "drizzle-orm/pg-core";
import type { ConnectorMethod, ConnectorStatus } from "@repo/schemas";

export const connectorsTable = pgTable("connectors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  method: text("method").$type<ConnectorMethod>().notNull(),
  status: text("status").$type<ConnectorStatus>().notNull().default("needs_setup"),
  scopes: text("scopes"),
  config: jsonb("config")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});
export type ConnectorRecord = typeof connectorsTable.$inferSelect;
