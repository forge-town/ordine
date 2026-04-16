import { sql } from "drizzle-orm";
import { text, timestamp, pgTable, index, serial } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs_table";

export type LogLevel = "info" | "warn" | "error" | "debug";

export const jobTracesTable = pgTable(
  "job_traces",
  {
    id: serial("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    level: text("level").$type<LogLevel>().notNull().default("info"),
    message: text("message").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    jobIdIdx: index("job_traces_job_id_idx").on(table.jobId),
    createdAtIdx: index("job_traces_created_at_idx").on(table.createdAt),
  }),
);

export type JobTraceRecord = typeof jobTracesTable.$inferSelect;
