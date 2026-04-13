import { text, pgTable, timestamp } from "drizzle-orm/pg-core";

export const LLM_PROVIDERS = ["kimi", "deepseek"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const settingsTable = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  llmProvider: text("llm_provider").notNull().default("kimi"),
  llmApiKey: text("llm_api_key").notNull().default(""),
  llmModel: text("llm_model").notNull().default("kimi-k2-0711-preview"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SettingsRow = typeof settingsTable.$inferSelect;
export type NewSettingsRow = typeof settingsTable.$inferInsert;
