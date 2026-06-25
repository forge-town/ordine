import { db } from "@repo/db";
import {
  createAgentsService,
  createDistillationsService,
  createJobsService,
  createOperationsService,
  createOperationRunnerService,
  createPipelineAgentSessionsService,
  createPipelineRunnerService,
  createPipelinesService,
  createSkillsService,
  listDirectory,
} from "@repo/services";

export const agentsService = createAgentsService(db);
export const distillationsService = createDistillationsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const operationRunnerService = createOperationRunnerService(db);
export const pipelineAgentSessionsService = createPipelineAgentSessionsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db);
export const skillsService = createSkillsService(db);

export { listDirectory };
