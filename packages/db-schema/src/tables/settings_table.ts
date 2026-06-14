import { text, pgTable, timestamp } from "drizzle-orm/pg-core";
import type { DefaultAgentRuntime } from "@repo/schemas";

export const settingsTable = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  // 出厂默认运行时改 claude-code（本地 CLI，无需外部 key）。原默认 mastra(+kimi 模型)
  // 需 KIMI_API_KEY，新装/未配 key 时任何未锁运行时的算子必崩（RUN-06）。仅影响新装；
  // 现有 settings 行不强改（不擅动用户数据），缺 key 由 runMastra 守卫秒级清晰报错。
  defaultAgentRuntime: text("default_agent_runtime")
    .$type<DefaultAgentRuntime>()
    .notNull()
    .default("claude-code"),
  defaultApiKey: text("default_api_key").notNull().default(""),
  defaultModel: text("default_model").notNull().default("kimi-for-coding/k2p6"),
  defaultOutputPath: text("default_output_path").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type SettingsRecord = typeof settingsTable.$inferSelect;
