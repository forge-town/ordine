import { sql } from "drizzle-orm";
import { jsonb, text, timestamp, pgTable } from "drizzle-orm/pg-core";
import type { CapabilityOrigin, CapabilitySource } from "@repo/schemas";

export const skillsTable = pgTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  origin: text("origin").$type<CapabilityOrigin>().notNull().default("manual"),
  sources: jsonb("sources")
    .$type<CapabilitySource[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type SkillRecord = typeof skillsTable.$inferSelect;
