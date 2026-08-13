import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type {
  CapabilityOrigin,
  CapabilitySource,
  ConnectorConfig,
  ConnectorMethod,
  ConnectorStatus,
  EncryptedCredentialMap,
} from "@repo/schemas";

export const connectorsTable = pgTable(
  "connectors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    method: text("method").$type<ConnectorMethod>().notNull(),
    status: text("status").$type<ConnectorStatus>().notNull().default("needs_setup"),
    scopes: text("scopes"),
    config: jsonb("config")
      .$type<ConnectorConfig>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    origin: text("origin").$type<CapabilityOrigin>().notNull().default("manual"),
    signature: text("signature"),
    sources: jsonb("sources")
      .$type<CapabilitySource[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    encryptedCredentials: jsonb("encrypted_credentials")
      .$type<EncryptedCredentialMap>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("connectors_signature_idx").on(table.signature)],
);

export type ConnectorRecord = typeof connectorsTable.$inferSelect;
