import type { ExecutionJobRepository, ExecutionRepository } from "@repo/models";

import type { ExecutionPreparationService } from "./helpers/preparation";

export type ExecutionApiService = ReturnType<typeof createExecutionApiService>;
import type { ArtifactStore, ExecutionApiServiceBindings } from "./contracts";

import { createScopedHelper, createRequireJobHelper } from "./helpers";

import {
  createListOperationsMethod,
  createGetOperationRevisionMethod,
  createListPipelinesMethod,
  createGetPipelineMethod,
  createGetRequestMethod,
  createListJobsMethod,
  createGetJobMethod,
  createListJobSummariesMethod,
  createGetJobSummaryMethod,
  createGetEventsMethod,
  createGetResultMethod,
  createListArtifactsMethod,
  createGetArtifactMethod,
  createReadArtifactMethod,
  createImportInputMethod,
  createControlJobMethod,
  createAckCheckpointMethod,
  createApproveMethod,
  createRejectMethod,
  createGetApprovalMethod,
  createListRuntimeConfigsMethod,
  createSaveRuntimeConfigMethod,
  createGetWorkspaceSettingsMethod,
  createSaveWorkspaceSettingsMethod,
} from "./methods";

export const createExecutionApiService = (deps: {
  repository: ExecutionRepository;
  jobs: ExecutionJobRepository;
  artifactStore: ArtifactStore;
  preparation: ExecutionPreparationService;
}) => {
  const serviceBindings: ExecutionApiServiceBindings = {
    get deps(): ExecutionApiServiceBindings["deps"] {
      return deps;
    },
    get scoped(): ExecutionApiServiceBindings["scoped"] {
      return scoped;
    },
    get requireJob(): ExecutionApiServiceBindings["requireJob"] {
      return requireJob;
    },
  };

  const scoped = createScopedHelper(serviceBindings);
  const requireJob = createRequireJobHelper(serviceBindings);

  return {
    ...deps.preparation,
    listOperations: createListOperationsMethod(serviceBindings),
    getOperationRevision: createGetOperationRevisionMethod(serviceBindings),
    listPipelines: createListPipelinesMethod(serviceBindings),
    getPipeline: createGetPipelineMethod(serviceBindings),
    getRequest: createGetRequestMethod(serviceBindings),
    listJobs: createListJobsMethod(serviceBindings),
    getJob: createGetJobMethod(serviceBindings),
    listJobSummaries: createListJobSummariesMethod(serviceBindings),
    getJobSummary: createGetJobSummaryMethod(serviceBindings),
    getEvents: createGetEventsMethod(serviceBindings),
    getResult: createGetResultMethod(serviceBindings),
    listArtifacts: createListArtifactsMethod(serviceBindings),
    getArtifact: createGetArtifactMethod(serviceBindings),
    readArtifact: createReadArtifactMethod(serviceBindings),
    importInput: createImportInputMethod(serviceBindings),
    controlJob: createControlJobMethod(serviceBindings),
    ackCheckpoint: createAckCheckpointMethod(serviceBindings),
    approve: createApproveMethod(serviceBindings),
    reject: createRejectMethod(serviceBindings),
    getApproval: createGetApprovalMethod(serviceBindings),
    listRuntimeConfigs: createListRuntimeConfigsMethod(serviceBindings),
    saveRuntimeConfig: createSaveRuntimeConfigMethod(serviceBindings),
    getWorkspaceSettings: createGetWorkspaceSettingsMethod(serviceBindings),
    saveWorkspaceSettings: createSaveWorkspaceSettingsMethod(serviceBindings),
  };
};
