import { sql } from "drizzle-orm";
import { text, pgTable, timestamp, jsonb, check } from "drizzle-orm/pg-core";
import {
  MAX_AGENT_SYSTEM_PROMPT_LENGTH,
  type AgentRuntime,
  type AgentCapability,
} from "@repo/schemas";

export const agentsTable = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    defaultRuntime: text("default_runtime").$type<AgentRuntime | null>(),
    systemPrompt: text("system_prompt"),
    capabilities: jsonb("capabilities")
      .$type<AgentCapability[]>()
      .notNull()
      .default([]),
    allowedTools: jsonb("allowed_tools")
      .$type<string[]>()
      .notNull()
      .default([]),
    allowedSkillIds: jsonb("allowed_skill_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "agents_system_prompt_max_length",
      sql`length(${table.systemPrompt}) <= ${MAX_AGENT_SYSTEM_PROMPT_LENGTH}`,
    ),
  ],
);

export type AgentRecord = typeof agentsTable.$inferSelect;
