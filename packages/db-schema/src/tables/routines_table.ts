import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { RoutineTriggerType } from "@repo/schemas";
import { pipelinesTable } from "./pipelines_table";

export const routinesTable = pgTable(
  "routines",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelinesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    triggerType: text("trigger_type").$type<RoutineTriggerType>().notNull(),
    cronExpression: text("cron_expression"),
    eventType: text("event_type"),
    eventConfig: jsonb("event_config").$type<Record<string, unknown>>(),
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
  ],
);

export type RoutineRecord = typeof routinesTable.$inferSelect;
