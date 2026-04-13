import { sql } from "drizzle-orm";
import { text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const bestPracticesTable = pgTable("best_practices", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  condition: text("condition").notNull(),
  content: text("content").notNull().default(""),
  category: text("category").notNull().default("general"),
  language: text("language").notNull().default("typescript"),
  codeSnippet: text("code_snippet").notNull().default(""),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BestPracticeRow = typeof bestPracticesTable.$inferSelect;
export type NewBestPracticeRow = typeof bestPracticesTable.$inferInsert;
