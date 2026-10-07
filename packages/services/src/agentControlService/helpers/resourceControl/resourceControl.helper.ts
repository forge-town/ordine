import {
  createAgentsDao,
  createConnectorsDao,
  createDistillationsDao,
  createJobsDao,
  createOperationsDao,
  createPipelineAssetsDao,
  createPipelinesDao,
  createProjectsDao,
  createRoutinesDao,
  createSkillsDao,
  type DbConnection,
} from "@repo/models";
import type { AgentResourceRef } from "@repo/schemas";
import { err } from "neverthrow";
import { createAgentsService } from "../../../agentsService";
import { createConnectorsService } from "../../../connectorsService";
import { createDistillationsService } from "../../../distillationsService";
import { createOperationsService } from "../../../operationsService";
import { createPipelineAssetsService } from "../../../pipelineAssetsService";
import { createPipelinesService } from "../../../pipelinesService";
import { createProjectsService } from "../../../projectsService";
import { createRoutinesService } from "../../../routinesService";
import { createSkillsService } from "../../../skillsService";

export type MutableAgentResourceType = keyof typeof createSchemas;

export type ResourceControlError = {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
};

export type ResourceControlValue = {
  resources: AgentResourceRef[];
  summary: string;
  data?: Record<string, unknown>;
  warnings?: string[];
};
import type { createSchemas, ResourceControlBindings } from "../../contracts";

import { createResourceControlListHelper } from "../resourceControlList";
import { createResourceControlFindByIdHelper } from "../resourceControlFindById";

import { createResourceControlSearchMethod } from "../../methods/resourceControlSearch";
import { createResourceControlGetMethod } from "../../methods/resourceControlGet";
import { createResourceControlDescribeMethod } from "../../methods/resourceControlDescribe";
import { createResourceControlCreateMethod } from "../../methods/resourceControlCreate";
import { createResourceControlUpdateMethod } from "../../methods/resourceControlUpdate";
import { createResourceControlArchiveMethod } from "../../methods/resourceControlArchive";
import { createResourceControlDeleteMethod } from "../../methods/resourceControlDelete";
import { createResourceControlTestConnectorMethod } from "../../methods/resourceControlTestConnector";

export const createResourceControl = (db: DbConnection) => {
  const serviceBindings: ResourceControlBindings = {
    get db() {
      return db;
    },
    get daos() {
      return daos;
    },
    get services() {
      return services;
    },
    get list() {
      return list;
    },
    get findById() {
      return findById;
    },
  };

  const daos = {
    project: createProjectsDao(db),
    pipeline: createPipelinesDao(db),
    operation: createOperationsDao(db),
    skill: createSkillsDao(db),
    agent: createAgentsDao(db),
    connector: createConnectorsDao(db),
    routine: createRoutinesDao(db),
    distillation: createDistillationsDao(db),
    "pipeline-asset": createPipelineAssetsDao(db),
    job: createJobsDao(db),
  } as const;
  const services = {
    project: createProjectsService(db),
    pipeline: createPipelinesService(db),
    operation: createOperationsService(db),
    skill: createSkillsService(db),
    agent: createAgentsService(db),
    connector: createConnectorsService(db),
    routine: createRoutinesService(db, {
      startRun: async () => err(new Error("Routine execution is owned by Agent Control")),
    }),
    distillation: createDistillationsService(db),
    "pipeline-asset": createPipelineAssetsService(db),
  } as const;

  const list = createResourceControlListHelper(serviceBindings);

  const findById = createResourceControlFindByIdHelper(serviceBindings);

  return {
    search: createResourceControlSearchMethod(serviceBindings),

    get: createResourceControlGetMethod(serviceBindings),

    describe: createResourceControlDescribeMethod(serviceBindings),

    create: createResourceControlCreateMethod(serviceBindings),

    update: createResourceControlUpdateMethod(serviceBindings),

    archive: createResourceControlArchiveMethod(serviceBindings),

    delete: createResourceControlDeleteMethod(serviceBindings),

    testConnector: createResourceControlTestConnectorMethod(serviceBindings),
  };
};
