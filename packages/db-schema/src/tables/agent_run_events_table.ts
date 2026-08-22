import { index, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { RuntimeEvent } from "@repo/schemas";
import { agentRunsTable } from "./agent_runs_table";

export const agentRunEventsTable = pgTable(
  "agent_run_events",
  {
    sequence: serial("sequence").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRunsTable.id, { onDelete: "cascade" }),
    event: jsonb("event").$type<RuntimeEvent>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("agent_run_events_run_sequence_idx").on(table.runId, table.sequence)],
);

export type AgentRunEventRecord = typeof agentRunEventsTable.$inferSelect;
