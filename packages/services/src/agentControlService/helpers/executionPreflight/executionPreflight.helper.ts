import {
  createOperationsDao,
  createPipelinesDao,
  createRoutinesDao,
  type DbConnection,
} from "@repo/models";

import { createCapabilityCatalogService } from "../../../capabilityCatalogService";

export type ExecutionPreflightError = {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
};

export type ExecutionPreflightValue = {
  requiresApproval: boolean;
  reasons: string[];
  operationIds: string[];
  pipelineId?: string;
};
import type { ExecutionPreflightBindings } from "../../contracts";

import { createExecutionPreflightInspectOperationsHelper } from "../executionPreflightInspectOperations";
import { createExecutionPreflightOperationMethod } from "../../methods/executionPreflightOperation";
import { createExecutionPreflightPipelineMethod } from "../../methods/executionPreflightPipeline";
import { createExecutionPreflightRoutineMethod } from "../../methods/executionPreflightRoutine";

export const createExecutionPreflight = (db: DbConnection) => {
  const serviceBindings: ExecutionPreflightBindings = {
    get db() {
      return db;
    },
    get operationsDao() {
      return operationsDao;
    },
    get pipelinesDao() {
      return pipelinesDao;
    },
    get routinesDao() {
      return routinesDao;
    },
    get capabilityCatalog() {
      return capabilityCatalog;
    },
    get inspectOperations() {
      return inspectOperations;
    },
  };

  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const routinesDao = createRoutinesDao(db);
  const capabilityCatalog = createCapabilityCatalogService(db);

  const inspectOperations = createExecutionPreflightInspectOperationsHelper(serviceBindings);

  return {
    operation: createExecutionPreflightOperationMethod(serviceBindings),

    pipeline: createExecutionPreflightPipelineMethod(serviceBindings),

    routine: createExecutionPreflightRoutineMethod(serviceBindings),
  };
};
