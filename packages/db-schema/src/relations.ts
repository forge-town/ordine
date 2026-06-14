import { relations } from "drizzle-orm";
import { annotationsTable } from "./tables/annotations_table";
import { conversationMessagesTable } from "./tables/conversation_messages_table";
import { githubProjectsTable } from "./tables/github_projects_table";
import { jobsTable } from "./tables/jobs_table";
import { pipelineAssetsTable } from "./tables/pipeline_assets_table";
import { pipelinesTable } from "./tables/pipelines_table";
import { pipelineRunsTable } from "./tables/pipeline_runs_table";
import { projectsTable } from "./tables/projects_table";
import { routinesTable } from "./tables/routines_table";
import { distillationRunsTable } from "./tables/distillation_runs_table";
import { distillationsTable } from "./tables/distillations_table";
import { refinementRunsTable } from "./tables/refinement_runs_table";
import { refinementsTable } from "./tables/refinements_table";

export const githubProjectsRelations = relations(githubProjectsTable, ({ many }) => ({
  pipelineRuns: many(pipelineRunsTable),
}));

export const projectsRelations = relations(projectsTable, ({ many }) => ({
  pipelines: many(pipelinesTable),
  jobs: many(jobsTable),
}));

export const pipelinesRelations = relations(pipelinesTable, ({ one, many }) => ({
  project: one(projectsTable, {
    fields: [pipelinesTable.projectId],
    references: [projectsTable.id],
  }),
  pipelineRuns: many(pipelineRunsTable),
  conversationMessages: many(conversationMessagesTable),
  annotations: many(annotationsTable),
  routines: many(routinesTable),
  pipelineAssets: many(pipelineAssetsTable),
}));

export const jobsRelations = relations(jobsTable, ({ one, many }) => ({
  parent: one(jobsTable, {
    fields: [jobsTable.parentJobId],
    references: [jobsTable.id],
    relationName: "jobParentChild",
  }),
  children: many(jobsTable, { relationName: "jobParentChild" }),
  pipeline: one(pipelinesTable, {
    fields: [jobsTable.pipelineId],
    references: [pipelinesTable.id],
  }),
  project: one(projectsTable, {
    fields: [jobsTable.projectId],
    references: [projectsTable.id],
  }),
  pipelineRun: one(pipelineRunsTable),
  distillationRun: one(distillationRunsTable),
  refinementRun: one(refinementRunsTable),
}));

export const conversationMessagesRelations = relations(conversationMessagesTable, ({ one }) => ({
  pipeline: one(pipelinesTable, {
    fields: [conversationMessagesTable.pipelineId],
    references: [pipelinesTable.id],
  }),
}));

export const annotationsRelations = relations(annotationsTable, ({ one }) => ({
  pipeline: one(pipelinesTable, {
    fields: [annotationsTable.pipelineId],
    references: [pipelinesTable.id],
  }),
}));

export const routinesRelations = relations(routinesTable, ({ one }) => ({
  pipeline: one(pipelinesTable, {
    fields: [routinesTable.pipelineId],
    references: [pipelinesTable.id],
  }),
}));

export const pipelineAssetsRelations = relations(pipelineAssetsTable, ({ one }) => ({
  pipeline: one(pipelinesTable, {
    fields: [pipelineAssetsTable.pipelineId],
    references: [pipelinesTable.id],
  }),
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
