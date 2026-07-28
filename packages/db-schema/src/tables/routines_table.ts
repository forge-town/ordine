import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { pipelinesTable } from "./pipelines_table";

export const routinesTable = pgTable(
  "routines",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelinesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    cronExpression: text("cron_expression"),
    inputConfig: jsonb("input_config").$type<Record<string, unknown>>(),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("routines_pipeline_id_idx").on(table.pipelineId),
    index("routines_enabled_idx").on(table.enabled),
    index("routines_enabled_next_run_at_idx").on(table.enabled, table.nextRunAt),
  ],
);

export type RoutineRecord = typeof routinesTable.$inferSelect;
