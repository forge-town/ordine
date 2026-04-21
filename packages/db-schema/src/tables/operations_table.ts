import { sql } from "drizzle-orm";
import { timestamp, text, pgTable, jsonb } from "drizzle-orm/pg-core";
import type { OperationConfigInput } from "@repo/pipeline-engine/schemas";

export const OBJECT_TYPES = ["file", "folder", "project"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const operationsTable = pgTable("operations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  config: jsonb("config").$type<OperationConfigInput>().notNull().default({}),
  acceptedObjectTypes: jsonb("accepted_object_types")
    .$type<ObjectType[]>()
    .notNull()
    .default(sql`'["file","folder","project"]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type OperationRecord = typeof operationsTable.$inferSelect;