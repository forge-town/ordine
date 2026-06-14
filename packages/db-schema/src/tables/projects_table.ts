import { sql } from "drizzle-orm";
import { text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});
export type ProjectRecord = typeof projectsTable.$inferSelect;
