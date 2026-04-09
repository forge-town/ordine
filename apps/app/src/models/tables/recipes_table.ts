import { timestamp, text, pgTable } from "drizzle-orm/pg-core";
import { operationsTable } from "./operations_table";
import { bestPracticesTable } from "./best_practices_table";

export const recipesTable = pgTable("recipes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  operationId: text("operation_id")
    .notNull()
    .references(() => operationsTable.id),
  bestPracticeId: text("best_practice_id")
    .notNull()
    .references(() => bestPracticesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RecipeRow = typeof recipesTable.$inferSelect;
export type NewRecipeRow = typeof recipesTable.$inferInsert;
