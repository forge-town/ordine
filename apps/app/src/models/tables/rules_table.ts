import { sql } from "drizzle-orm";
import { text, timestamp, boolean, pgTable } from "drizzle-orm/pg-core";

export type RuleSeverity = "error" | "warning" | "info";
export type RuleCategory = "lint" | "security" | "style" | "performance" | "custom";

export const rulesTable = pgTable("rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").$type<RuleCategory>().notNull().default("custom"),
  severity: text("severity").$type<RuleSeverity>().notNull().default("warning"),
  pattern: text("pattern"),
  enabled: boolean("enabled").notNull().default(true),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RuleRow = typeof rulesTable.$inferSelect;
export type NewRuleRow = typeof rulesTable.$inferInsert;
