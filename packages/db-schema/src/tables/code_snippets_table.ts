import { text, timestamp, integer, pgTable } from "drizzle-orm/pg-core";
import { bestPracticesTable } from "./best_practices_table";

export const codeSnippetsTable = pgTable("code_snippets", {
  id: text("id").primaryKey(),
  bestPracticeId: text("best_practice_id")
    .notNull()
    .references(() => bestPracticesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  language: text("language").notNull().default("typescript"),
  code: text("code").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CodeSnippetRow = typeof codeSnippetsTable.$inferSelect;
export type NewCodeSnippetRow = typeof codeSnippetsTable.$inferInsert;
