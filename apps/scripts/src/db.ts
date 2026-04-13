import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { timestamp, text, pgTable, jsonb, boolean } from "drizzle-orm/pg-core";

// ─── Operations Table (mirrors apps/app/src/models/tables/operations_table.ts) ─

export const OBJECT_TYPES = ["file", "folder", "project"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const operationsTable = pgTable("operations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  config: text("config").notNull().default("{}"),
  acceptedObjectTypes: jsonb("accepted_object_types")
    .notNull()
    .default(["file", "folder", "project"]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewOperationRow = typeof operationsTable.$inferInsert;

// ─── Pipelines Table (mirrors apps/app/src/models/tables/pipelines_table.ts) ─

export const pipelinesTable = pgTable("pipelines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  tags: jsonb("tags")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  nodes: jsonb("nodes")
    .notNull()
    .default(sql`'[]'::jsonb`),
  edges: jsonb("edges")
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewPipelineRow = typeof pipelinesTable.$inferInsert;

// ─── Best Practices Table (mirrors apps/app/src/models/tables/best_practices_table.ts)

export const bestPracticesTable = pgTable("best_practices", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  condition: text("condition").notNull(),
  content: text("content").notNull().default(""),
  category: text("category").notNull().default("general"),
  language: text("language").notNull().default("typescript"),
  codeSnippet: text("code_snippet").notNull().default(""),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewBestPracticeRow = typeof bestPracticesTable.$inferInsert;

// ─── Recipes Table (mirrors apps/app/src/models/tables/recipes_table.ts) ─────

export const recipesTable = pgTable("recipes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  operationId: text("operation_id")
    .notNull()
    .references(() => operationsTable.id),
  bestPracticeId: text("best_practice_id")
    .notNull()
    .references(() => bestPracticesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewRecipeRow = typeof recipesTable.$inferInsert;

// ─── Rules Table (mirrors apps/app/src/models/tables/rules_table.ts) ─────────

export type RuleSeverity = "error" | "warning" | "info";
export type RuleCategory = "lint" | "security" | "style" | "performance" | "custom";

export const rulesTable = pgTable("rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").$type<RuleCategory>().notNull().default("custom"),
  severity: text("severity").$type<RuleSeverity>().notNull().default("warning"),
  checkScript: text("check_script"),
  scriptLanguage: text("script_language").notNull().default("typescript"),
  acceptedObjectTypes: jsonb("accepted_object_types")
    .notNull()
    .default(["file", "folder", "project"]),
  enabled: boolean("enabled").notNull().default(true),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NewRuleRow = typeof rulesTable.$inferInsert;

// ─── DB Connection ────────────────────────────────────────────────────────────

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(databaseUrl);
export const db = drizzle(client, {
  schema: { operationsTable, pipelinesTable, bestPracticesTable, recipesTable, rulesTable },
});
export { client };
