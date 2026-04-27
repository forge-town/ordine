import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { RefinementRound, RefinementStatus } from "@repo/schemas";

export const refinementsTable = pgTable(
  "refinements",
  {
    id: text("id").primaryKey(),
    sourceDistillationId: text("source_distillation_id").notNull(),
    maxRounds: integer("max_rounds").notNull().default(3),
    currentRound: integer("current_round").notNull().default(0),
    status: text("status").$type<RefinementStatus>().notNull().default("pending"),
    rounds: jsonb("rounds").$type<RefinementRound[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("refinements_source_distillation_id_idx").on(table.sourceDistillationId),
    index("refinements_status_idx").on(table.status),
  ],
);

export type RefinementRecord = typeof refinementsTable.$inferSelect;
