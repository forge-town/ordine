import { text, pgTable, timestamp, jsonb } from "drizzle-orm/pg-core";
import type { AgentRuntime, RuntimeConnection } from "@repo/schemas";

export const agentRuntimesTable = pgTable("agent_runtimes", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  type: text("type").$type<AgentRuntime>().notNull().default("claude-code"),
  connection: jsonb("connection").$type<RuntimeConnection>().notNull().default({ mode: "local" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AgentRuntimeRecord = typeof agentRuntimesTable.$inferSelect;
