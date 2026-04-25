import { text, pgTable, timestamp } from "drizzle-orm/pg-core";
import type { AgentRuntime } from "@repo/schemas";

export const settingsTable = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  defaultAgentRuntime: text("default_agent_runtime").$type<AgentRuntime>().notNull().default("mastra"),
  defaultApiKey: text("default_api_key").notNull().default(""),
  defaultModel: text("default_model").notNull().default("kimi-for-coding/k2p6"),
  defaultOutputPath: text("default_output_path").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type SettingsRecord = typeof settingsTable.$inferSelect;
