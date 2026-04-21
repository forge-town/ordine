import { text, pgTable, timestamp } from "drizzle-orm/pg-core";

export const LLM_PROVIDERS = ["local-claude", "codex"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const settingsTable = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  llmProvider: text("llm_provider").notNull().default("local-claude"),
  llmApiKey: text("llm_api_key").notNull().default(""),
  llmModel: text("llm_model").notNull().default("kimi-k2-0711-preview"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type SettingsRecord = typeof settingsTable.$inferSelect;
