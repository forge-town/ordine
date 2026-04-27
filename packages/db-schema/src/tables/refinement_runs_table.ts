import { text, timestamp, pgTable, index } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs_table";
import { refinementsTable } from "./refinements_table";

export const refinementRunsTable = pgTable(
  "refinement_runs",
  {
    id: text("id")
      .primaryKey()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    refinementId: text("refinement_id")
      .notNull()
      .references(() => refinementsTable.id),
    sourceDistillationId: text("source_distillation_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("refinement_runs_refinement_id_idx").on(table.refinementId),
    index("refinement_runs_source_distillation_id_idx").on(table.sourceDistillationId),
  ],
);
export type RefinementRunRecord = typeof refinementRunsTable.$inferSelect;
