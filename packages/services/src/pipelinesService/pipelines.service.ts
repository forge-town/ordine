import "../text-imports.d.ts";

import {
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
  type DbConnection,
} from "@repo/models";

import type { ObjectNodeType } from "@repo/schemas";

import type {
  createCapabilityCatalogService,
  CapabilityCatalogServiceOptions,
} from "../capabilityCatalogService";

export interface PipelinesServiceOptions {
  capabilityCatalog?: ReturnType<typeof createCapabilityCatalogService>;
  capabilityCatalogOptions?: CapabilityCatalogServiceOptions;
}

export interface PendingOperationInput {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  acceptedObjectTypes: ObjectNodeType[];
  sourceSkillId?: string;
}
import type { PipelinesServiceBindings } from "./contracts";

import { createGetCapabilityCatalogHelper, createInsertPendingOperationsHelper } from "./helpers";

import {
  createCreatePendingOperationsMethod,
  createCreateMethod,
  createCreateWithPendingOperationsMethod,
  createUpdateMethod,
  createGetAllMethod,
  createGetByIdMethod,
  createUpdateOperationExecutorsMethod,
  createDeleteMethod,
  createProposeActionsMethod,
  createOptimizeFromDistillationMethod,
  createAnalyzeIntentMethod,
  createGenerateStructureMethod,
} from "./methods";

export const createPipelinesService = (db: DbConnection, options: PipelinesServiceOptions = {}) => {
  const serviceBindings: PipelinesServiceBindings = {
    get db(): PipelinesServiceBindings["db"] {
      return db;
    },
    get options(): PipelinesServiceBindings["options"] {
      return options;
    },
    get agentRuntimesDao(): PipelinesServiceBindings["agentRuntimesDao"] {
      return agentRuntimesDao;
    },
    get conversationMessagesDao(): PipelinesServiceBindings["conversationMessagesDao"] {
      return conversationMessagesDao;
    },
    get dao(): PipelinesServiceBindings["dao"] {
      return dao;
    },
    get distillationsDao(): PipelinesServiceBindings["distillationsDao"] {
      return distillationsDao;
    },
    get jobsDao(): PipelinesServiceBindings["jobsDao"] {
      return jobsDao;
    },
    get pipelineRunsDao(): PipelinesServiceBindings["pipelineRunsDao"] {
      return pipelineRunsDao;
    },
    get jobTracesDao(): PipelinesServiceBindings["jobTracesDao"] {
      return jobTracesDao;
    },
    get operationsDao(): PipelinesServiceBindings["operationsDao"] {
      return operationsDao;
    },
    get operationRegistryRepository(): PipelinesServiceBindings["operationRegistryRepository"] {
      return operationRegistryRepository;
    },
    get settingsDao(): PipelinesServiceBindings["settingsDao"] {
      return settingsDao;
    },
    get getCapabilityCatalog(): PipelinesServiceBindings["getCapabilityCatalog"] {
      return getCapabilityCatalog;
    },
    get insertPendingOperations(): PipelinesServiceBindings["insertPendingOperations"] {
      return insertPendingOperations;
    },
    get createPendingOperations(): PipelinesServiceBindings["createPendingOperations"] {
      return createPendingOperations;
    },
    get create(): PipelinesServiceBindings["create"] {
      return create;
    },
    get createWithPendingOperations(): PipelinesServiceBindings["createWithPendingOperations"] {
      return createWithPendingOperations;
    },
    get update(): PipelinesServiceBindings["update"] {
      return update;
    },
  };

  const agentRuntimesDao = createAgentRuntimesDao(db);
  const conversationMessagesDao = createConversationMessagesDao(db);
  const dao = createPipelinesDao(db);
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const pipelineRunsDao = createPipelineRunsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const operationsDao = createOperationsDao(db);
  const operationRegistryRepository = createOperationRegistryRepository(db);
  const settingsDao = createSettingsDao(db);
  const getCapabilityCatalog = createGetCapabilityCatalogHelper(serviceBindings);
  const insertPendingOperations = createInsertPendingOperationsHelper(serviceBindings);

  const createPendingOperations = createCreatePendingOperationsMethod(serviceBindings);

  const create = createCreateMethod(serviceBindings);

  const createWithPendingOperations = createCreateWithPendingOperationsMethod(serviceBindings);

  const update = createUpdateMethod(serviceBindings);

  return {
    getAll: createGetAllMethod(serviceBindings),
    getById: createGetByIdMethod(serviceBindings),
    create,
    createPendingOperations,
    createWithPendingOperations,
    updateOperationExecutors: createUpdateOperationExecutorsMethod(serviceBindings),
    update,
    delete: createDeleteMethod(serviceBindings),

    proposeActions: createProposeActionsMethod(serviceBindings),

    optimizeFromDistillation: createOptimizeFromDistillationMethod(serviceBindings),

    analyzeIntent: createAnalyzeIntentMethod(serviceBindings),

    generateStructure: createGenerateStructureMethod(serviceBindings),
  };
};
