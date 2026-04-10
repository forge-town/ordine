import { text, timestamp, integer, pgTable } from "drizzle-orm/pg-core";
import { bestPracticesTable } from "./best_practices_table";

export type ChecklistItemCheckType = "script" | "llm";

export const checklistItemsTable = pgTable("checklist_items", {
  id: text("id").primaryKey(),
  bestPracticeId: text("best_practice_id")
    .notNull()
    .references(() => bestPracticesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  checkType: text("check_type").$type<ChecklistItemCheckType>().notNull().default("llm"),
  script: text("script"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ChecklistItemRow = typeof checklistItemsTable.$inferSelect;
export type NewChecklistItemRow = typeof checklistItemsTable.$inferInsert;
