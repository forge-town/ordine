import { sql } from "drizzle-orm";
import { text, timestamp, boolean, pgTable, jsonb } from "drizzle-orm/pg-core";

export type RuleSeverity = "error" | "warning" | "info";
export type RuleCategory =
  | "lint"
  | "security"
  | "style"
  | "performance"
  | "structure"
  | "testing"
  | "custom";
export type RuleScriptLanguage = "typescript" | "bash";

export const rulesTable = pgTable("rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").$type<RuleCategory>().notNull().default("custom"),
  severity: text("severity").$type<RuleSeverity>().notNull().default("warning"),
  checkScript: text("check_script"),
  scriptLanguage: text("script_language").$type<RuleScriptLanguage>().default("typescript"),
  acceptedObjectTypes: jsonb("accepted_object_types")
    .$type<string[]>()
    .notNull()
    .default(sql`'["file","folder","project"]'::jsonb`),
  enabled: boolean("enabled").notNull().default(true),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type RuleRecord = typeof rulesTable.$inferSelect;