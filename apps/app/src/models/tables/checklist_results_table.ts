import { text, timestamp, boolean, pgTable } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs_table";
import { checklistItemsTable } from "./checklist_items_table";

export const checklistResultsTable = pgTable("checklist_results", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  checklistItemId: text("checklist_item_id")
    .notNull()
    .references(() => checklistItemsTable.id, { onDelete: "cascade" }),
  passed: boolean("passed").notNull().default(false),
  output: text("output").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChecklistResultRow = typeof checklistResultsTable.$inferSelect;
export type NewChecklistResultRow = typeof checklistResultsTable.$inferInsert;
