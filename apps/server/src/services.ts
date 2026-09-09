import { db } from "@repo/db";
import {
  configureAgentRunController,
  createAgentControlService,
  createCanvasExecutionPublisher,
  createOperationExecutionPublisher,
  createExecutionConfigurationPublisher,
  createSettingsService,
  createAgentThreadsService,
  createAgentsService,
  createAgentRunsService,
  createAgentRunController,
  createAgentRuntimesService,
  createConnectorsService,
  createConversationMessagesService,
  createDistillationsService,
  createJobsService,
  createOperationsService,
  createPipelineAgentSessionsService,
  createPipelineAssetsService,
  createPipelinesService,
  createProjectsService,
  createRoutinesService,
  createSkillsService,
  createUsageService,
  agentRunCapabilityStore,
  listDirectory,
} from "@repo/services";
import { err, ok } from "neverthrow";
import { executionGateway } from "./integrations/executionGateway";

export const agentsService = createAgentsService(db);
export const agentRunsService = createAgentRunsService(db);
const agentRunController = createAgentRunController(agentRunsService);
configureAgentRunController(agentRunController);
export const agentRuntimesService = createAgentRuntimesService(db);
export const settingsService = createSettingsService(db);
const executionConfigurationPublisher = createExecutionConfigurationPublisher({
  gateway: executionGateway,
  readRuntimes: () => agentRuntimesService.getAll(),
  readSettings: () => settingsService.get(),
});
export const connectorsService = createConnectorsService(db);
export const conversationMessagesService = createConversationMessagesService(db);
export const distillationsService = createDistillationsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const pipelineAgentSessionsService = createPipelineAgentSessionsService(db, {
  agentRunsService,
});
export const pipelineAssetsService = createPipelineAssetsService(db);
export const pipelinesService = createPipelinesService(db);
export const canvasExecutionPublisher = createCanvasExecutionPublisher({
  gateway: executionGateway,
  readPipeline: (id) => pipelinesService.getById(id),
  readOperations: () => operationsService.getAll(),
  publishConfiguration: executionConfigurationPublisher.publish,
});
export const operationExecutionPublisher = createOperationExecutionPublisher({
  gateway: executionGateway,
  readOperations: () => operationsService.getAll(),
  publishConfiguration: executionConfigurationPublisher.publish,
});
export const projectsService = createProjectsService(db);
export const routinesService = createRoutinesService(db, {
  startRun: async () => err(new Error("旧定时执行入口已停用，请提交 v2 运行请求并确认。")),
});
export const skillsService = createSkillsService(db);
export const usageService = createUsageService(db);

export const agentThreadsService = createAgentThreadsService(db);
export const agentControlService = createAgentControlService(db, {
  runEvents: {
    getRun: (runId) => agentRunsService.getById(runId),
    append: (runId, event) => agentRunsService.appendControlEvent(runId, event),
  },
  execution: {
    submissionMode: "prepared-run",
    runPipeline: async (input) =>
      canvasExecutionPublisher.prepare({ ...input, requestId: input.requestId! }),
    runOperation: async (input) =>
      operationExecutionPublisher.prepare({ ...input, requestId: input.requestId! }),
    runRoutine: async (routineId, requestId) => {
      const routine = await routinesService.getById(routineId);
      if (!routine) return err(new Error("定时任务不存在。"));

      return canvasExecutionPublisher.prepare({
        pipelineId: routine.pipelineId,
        requestId: requestId!,
      });
    },
    controlJob: async (jobId, action) => executionGateway.controlJob(jobId, action),
    getJobTrace: async (jobId, afterSequence) => {
      const [job, events, result] = await Promise.all([
        executionGateway.getJob(jobId),
        executionGateway.getEvents(jobId, afterSequence),
        executionGateway.getJobResult(jobId),
      ]);
      if (job.isErr()) return err(job.error);
      if (events.isErr()) return err(events.error);
      if (result.isErr()) return err(result.error);

      return ok({
        job: job.value,
        events: events.value,
        result: result.value,
        nextCursor: events.value.length === 1000 ? String(events.value.at(-1)!.sequence) : null,
      });
    },
  },
});

export { agentRunCapabilityStore, listDirectory };
