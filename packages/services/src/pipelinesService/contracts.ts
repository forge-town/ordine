import type { createCapabilityCatalogService } from "../capabilityCatalogService";
import "../text-imports.d.ts";

import type {
  createAgentRuntimesDao,
  createConversationMessagesDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createOperationsDao,
  createOperationRegistryRepository,
  createPipelineRunsDao,
  createPipelinesDao,
  createSettingsDao,
  DbConnection,
  DbExecutor,
} from "@repo/models";
import type { ResultAsync } from "neverthrow";

import type { ConflictError, NotFoundError, ServiceError } from "../serviceErrors";

import type { PipelineOperationReferencesError } from "./helpers/checkPipelineOperationReferences/checkPipelineOperationReferences.helper";

import type { PipelinesServiceOptions, PendingOperationInput } from "./pipelines.service";
export const MAX_STRUCTURE_DIAGNOSTIC_ISSUES = 8;
export const MAX_STRUCTURE_SCHEMA_RETRIES = 1;
export const CAPABILITY_ASSIGNMENT_AGENT_ID = "pipeline-capability-assignment";
export interface PipelinesServiceBindings {
  db: DbConnection;
  options: PipelinesServiceOptions;
  agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>;
  conversationMessagesDao: ReturnType<typeof createConversationMessagesDao>;
  dao: ReturnType<typeof createPipelinesDao>;
  distillationsDao: ReturnType<typeof createDistillationsDao>;
  jobsDao: ReturnType<typeof createJobsDao>;
  pipelineRunsDao: ReturnType<typeof createPipelineRunsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  operationRegistryRepository: ReturnType<typeof createOperationRegistryRepository>;
  settingsDao: ReturnType<typeof createSettingsDao>;
  getCapabilityCatalog: (executor: DbExecutor) => ReturnType<typeof createCapabilityCatalogService>;
  insertPendingOperations: (
    executor: DbExecutor,
    pendingOperations: PendingOperationInput[],
  ) => Promise<void>;
  createPendingOperations: (
    pendingOperations: PendingOperationInput[],
  ) => ResultAsync<void, ServiceError | NotFoundError | ConflictError>;
  create: (
    pipeline: Parameters<PipelinesServiceBindings["dao"]["create"]>[0],
  ) => ResultAsync<
    Awaited<ReturnType<PipelinesServiceBindings["dao"]["create"]>>,
    ServiceError | NotFoundError | ConflictError | PipelineOperationReferencesError
  >;
  createWithPendingOperations: (
    pipeline: Parameters<PipelinesServiceBindings["dao"]["create"]>[0],
    pendingOperations: PendingOperationInput[],
  ) => ResultAsync<
    Awaited<ReturnType<PipelinesServiceBindings["dao"]["create"]>>,
    ServiceError | NotFoundError | ConflictError | PipelineOperationReferencesError
  >;
  update: (
    id: string,
    patch: Parameters<PipelinesServiceBindings["dao"]["update"]>[1],
  ) => ResultAsync<
    Awaited<ReturnType<PipelinesServiceBindings["dao"]["update"]>>,
    ServiceError | NotFoundError | ConflictError | PipelineOperationReferencesError
  >;
}

import {
  AssignedOperationExecutorConfigSchema,
  type AgentRuntime,
  type CapabilityCatalogEntry,
} from "@repo/schemas";
import { z } from "zod/v4";

const ReferenceSchema = z.string().trim().min(1);

export const PerStepCapabilityAssignmentSchema = z
  .object({
    operationId: ReferenceSchema,
    executor: AssignedOperationExecutorConfigSchema,
  })
  .strict();
export type PerStepCapabilityAssignment = z.infer<typeof PerStepCapabilityAssignmentSchema>;

export const CapabilityAssignmentOutputSchema = z
  .object({
    assignments: z.array(PerStepCapabilityAssignmentSchema).min(1).max(50),
  })
  .strict();

export type CapabilityAssignmentStep = {
  operationId: string;
  name: string;
  description: string;
};

export type CapabilityAssignmentAgentTarget = {
  agent: AgentRuntime;
  models: string[];
};

export type CapabilityAssignmentContext = {
  steps: CapabilityAssignmentStep[];
  agentTargets: CapabilityAssignmentAgentTarget[];
  capabilityCatalog: CapabilityCatalogEntry[];
};

export type CapabilityAssignmentParseResult =
  | { ok: true; assignments: PerStepCapabilityAssignment[]; diagnostics: [] }
  | { ok: false; assignments: []; diagnostics: string[] };
