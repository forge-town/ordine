import { relations } from "drizzle-orm";
import { bestPracticesTable } from "./tables/best_practices_table";
import { checklistItemsTable } from "./tables/checklist_items_table";
import { checklistResultsTable } from "./tables/checklist_results_table";
import { codeSnippetsTable } from "./tables/code_snippets_table";
import { githubProjectsTable } from "./tables/github_projects_table";
import { jobsTable } from "./tables/jobs_table";
import { operationsTable } from "./tables/operations_table";
import { pipelinesTable } from "./tables/pipelines_table";
import { recipesTable } from "./tables/recipes_table";

export const githubProjectsRelations = relations(githubProjectsTable, ({ many }) => ({
  jobs: many(jobsTable),
}));

export const pipelinesRelations = relations(pipelinesTable, ({ many }) => ({
  jobs: many(jobsTable),
}));

export const jobsRelations = relations(jobsTable, ({ one, many }) => ({
  project: one(githubProjectsTable, {
    fields: [jobsTable.projectId],
    references: [githubProjectsTable.id],
  }),
  pipeline: one(pipelinesTable, {
    fields: [jobsTable.pipelineId],
    references: [pipelinesTable.id],
  }),
  checklistResults: many(checklistResultsTable),
}));

export const checklistResultsRelations = relations(checklistResultsTable, ({ one }) => ({
  job: one(jobsTable, {
    fields: [checklistResultsTable.jobId],
    references: [jobsTable.id],
  }),
  checklistItem: one(checklistItemsTable, {
    fields: [checklistResultsTable.checklistItemId],
    references: [checklistItemsTable.id],
  }),
}));

export const checklistItemsRelations = relations(checklistItemsTable, ({ one, many }) => ({
  bestPractice: one(bestPracticesTable, {
    fields: [checklistItemsTable.bestPracticeId],
    references: [bestPracticesTable.id],
  }),
  checklistResults: many(checklistResultsTable),
}));

export const bestPracticesRelations = relations(bestPracticesTable, ({ many }) => ({
  checklistItems: many(checklistItemsTable),
  codeSnippets: many(codeSnippetsTable),
  recipes: many(recipesTable),
}));

export const codeSnippetsRelations = relations(codeSnippetsTable, ({ one }) => ({
  bestPractice: one(bestPracticesTable, {
    fields: [codeSnippetsTable.bestPracticeId],
    references: [bestPracticesTable.id],
  }),
}));

export const operationsRelations = relations(operationsTable, ({ many }) => ({
  recipes: many(recipesTable),
}));

export const recipesRelations = relations(recipesTable, ({ one }) => ({
  operation: one(operationsTable, {
    fields: [recipesTable.operationId],
    references: [operationsTable.id],
  }),
  bestPractice: one(bestPracticesTable, {
    fields: [recipesTable.bestPracticeId],
    references: [bestPracticesTable.id],
  }),
}));
