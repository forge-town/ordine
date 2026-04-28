import { text, timestamp, jsonb, pgTable, index } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs_table";
import { distillationsTable } from "./distillations_table";

export const distillationRunsTable = pgTable(
  "distillation_runs",
  {
    id: text("id")
      .primaryKey()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    distillationId: text("distillation_id")
      .notNull()
      .references(() => distillationsTable.id),
    inputSnapshot: jsonb("input_snapshot").$type<unknown>(),
    result: jsonb("result").$type<unknown>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("distillation_runs_distillation_id_idx").on(table.distillationId)],
);
export type DistillationRunRecord = typeof distillationRunsTable.$inferSelect;
