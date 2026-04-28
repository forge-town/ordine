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
import { pipelineRunsTable } from "./tables/pipeline_runs_table";
import { distillationRunsTable } from "./tables/distillation_runs_table";
import { distillationsTable } from "./tables/distillations_table";
import { refinementRunsTable } from "./tables/refinement_runs_table";
import { refinementsTable } from "./tables/refinements_table";

export const githubProjectsRelations = relations(githubProjectsTable, ({ many }) => ({
  pipelineRuns: many(pipelineRunsTable),
}));

export const pipelinesRelations = relations(pipelinesTable, ({ many }) => ({
  pipelineRuns: many(pipelineRunsTable),
}));

export const jobsRelations = relations(jobsTable, ({ one, many }) => ({
  parent: one(jobsTable, {
    fields: [jobsTable.parentJobId],
    references: [jobsTable.id],
    relationName: "jobParentChild",
  }),
  children: many(jobsTable, { relationName: "jobParentChild" }),
  pipelineRun: one(pipelineRunsTable),
  distillationRun: one(distillationRunsTable),
  refinementRun: one(refinementRunsTable),
  checklistResults: many(checklistResultsTable),
}));

export const pipelineRunsRelations = relations(pipelineRunsTable, ({ one }) => ({
  job: one(jobsTable, {
    fields: [pipelineRunsTable.id],
    references: [jobsTable.id],
  }),
  pipeline: one(pipelinesTable, {
    fields: [pipelineRunsTable.pipelineId],
    references: [pipelinesTable.id],
  }),
  project: one(githubProjectsTable, {
    fields: [pipelineRunsTable.projectId],
    references: [githubProjectsTable.id],
  }),
}));

export const distillationRunsRelations = relations(distillationRunsTable, ({ one }) => ({
  job: one(jobsTable, {
    fields: [distillationRunsTable.id],
    references: [jobsTable.id],
  }),
  distillation: one(distillationsTable, {
    fields: [distillationRunsTable.distillationId],
    references: [distillationsTable.id],
  }),
}));

export const refinementRunsRelations = relations(refinementRunsTable, ({ one }) => ({
  job: one(jobsTable, {
    fields: [refinementRunsTable.id],
    references: [jobsTable.id],
  }),
  refinement: one(refinementsTable, {
    fields: [refinementRunsTable.refinementId],
    references: [refinementsTable.id],
  }),
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
