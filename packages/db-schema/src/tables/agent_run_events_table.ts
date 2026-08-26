import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { AgentRunEvent } from "@repo/schemas";
import { agentRunsTable } from "./agent_runs_table";

export const agentRunEventsTable = pgTable(
  "agent_run_events",
  {
    sequence: serial("sequence").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRunsTable.id, { onDelete: "cascade" }),
    event: jsonb("event").$type<AgentRunEvent>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_run_events_run_sequence_idx").on(table.runId, table.sequence),
    uniqueIndex("agent_run_events_one_terminal_idx")
      .on(table.runId)
      .where(sql`${table.event}->>'type' = 'terminal'`),
  ],
);

export type AgentRunEventRecord = typeof agentRunEventsTable.$inferSelect;
