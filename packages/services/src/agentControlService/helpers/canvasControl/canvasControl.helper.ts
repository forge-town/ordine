import {
  createAgentActionsDao,
  createAgentChangeSetsDao,
  createAgentControlRepository,
  createOperationsDao,
  createPipelinesDao,
  type DbConnection,
} from "@repo/models";

import type { AgentControlToolResult, PipelineAction } from "@repo/schemas";

export type CanvasControlError = {
  actionId: string;
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
  nodeId?: string;
  portId?: string;
};

export type CanvasMutationValue = {
  actionId: string;
  changeSetId: string;
  pipelineId: string;
  pipelineAction: PipelineAction;
  result: AgentControlToolResult;
  replayed: boolean;
};

export type CanvasReadValue = {
  resources: Array<{ type: "pipeline"; id: string; label?: string }>;
  summary: string;
  data: Record<string, unknown>;
  warnings?: string[];
};
import type { CanvasControlBindings } from "../../contracts";

import { createCanvasControlValidateOperationReferencesHelper } from "../canvasControlValidateOperationReferences";
import { createCanvasControlValidateSnapshotHelper } from "../canvasControlValidateSnapshot";
import { createCanvasControlResolveSnapshotHelper } from "../canvasControlResolveSnapshot";

import { createCanvasControlInspectMethod } from "../../methods/canvasControlInspect";
import { createCanvasControlApplyMutationMethod } from "../../methods/canvasControlApplyMutation";
import { createCanvasControlValidateMethod } from "../../methods/canvasControlValidate";
import { createCanvasControlFinishMethod } from "../../methods/canvasControlFinish";

export const createCanvasControl = (
  db: DbConnection,
  digestArguments: (input: unknown) => string,
) => {
  const serviceBindings: CanvasControlBindings = {
    get db() {
      return db;
    },
    get digestArguments() {
      return digestArguments;
    },
    get actionsDao() {
      return actionsDao;
    },
    get changeSetsDao() {
      return changeSetsDao;
    },
    get operationsDao() {
      return operationsDao;
    },
    get pipelinesDao() {
      return pipelinesDao;
    },
    get repository() {
      return repository;
    },
    get validateOperationReferences() {
      return validateOperationReferences;
    },
    get validateSnapshot() {
      return validateSnapshot;
    },
    get resolveSnapshot() {
      return resolveSnapshot;
    },
  };

  const actionsDao = createAgentActionsDao(db);
  const changeSetsDao = createAgentChangeSetsDao(db);
  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const repository = createAgentControlRepository(db);

  const validateOperationReferences =
    createCanvasControlValidateOperationReferencesHelper(serviceBindings);

  const validateSnapshot = createCanvasControlValidateSnapshotHelper(serviceBindings);

  const resolveSnapshot = createCanvasControlResolveSnapshotHelper(serviceBindings);

  return {
    inspect: createCanvasControlInspectMethod(serviceBindings),

    applyMutation: createCanvasControlApplyMutationMethod(serviceBindings),

    validate: createCanvasControlValidateMethod(serviceBindings),

    finish: createCanvasControlFinishMethod(serviceBindings),
  };
};
