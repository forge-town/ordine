import { timestamp, text, pgTable } from "drizzle-orm/pg-core";
import type { TemplateContentType } from "@repo/schemas";

export const operationOutputItemTemplatesTable = pgTable("operation_output_item_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  contentType: text("content_type").$type<TemplateContentType>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type OperationOutputItemTemplateRecord = typeof operationOutputItemTemplatesTable.$inferSelect;
