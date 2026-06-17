import { db } from "@repo/db";
import {
  createAgentsService,
  createAgentRuntimesService,
  createArtifactsService,
  createAnnotationsService,
  createConnectorsService,
  createConversationMessagesService,
  createDistillationsService,
  createGithubProjectsService,
  createJobsService,
  createOperationsService,
  createOperationRunnerService,
  createPipelineAssetsService,
  createPipelineRunnerService,
  createPipelinesService,
  createProjectsService,
  createRefinementsService,
  createRoutinesService,
  createRoutineSchedulerService,
  createSettingsService,
  createSkillsService,
  createOperationOutputItemTemplatesService,
  createUsageService,
} from "@repo/services";

export const agentsService = createAgentsService(db);
export const agentRuntimesService = createAgentRuntimesService(db);
export const artifactsService = createArtifactsService();
export const annotationsService = createAnnotationsService(db);
export const connectorsService = createConnectorsService(db);
export const conversationMessagesService = createConversationMessagesService(db);
export const distillationsService = createDistillationsService(db);
export const githubProjectsService = createGithubProjectsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const operationRunnerService = createOperationRunnerService(db);
export const pipelineAssetsService = createPipelineAssetsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db);
export const projectsService = createProjectsService(db);
export const refinementsService = createRefinementsService(db);
export const routinesService = createRoutinesService(db);
export const routineSchedulerService = createRoutineSchedulerService(db, {
  startRun: pipelineRunnerService.startRun,
});
export const settingsService = createSettingsService(db);
export const skillsService = createSkillsService(db);
export const operationOutputItemTemplatesService = createOperationOutputItemTemplatesService(db);
export const usageService = createUsageService(db);

// SCHED-02：start() 在模块作用域调用，vite/SSR 热重载会重新求值本模块 → 每次
// 都 new 一个 setInterval，旧 interval 不被清理 → 定时器叠加、routine 重复触发。
// 仿 INFRA-01，用 globalThis 标志保证整个进程生命周期内只 start 一次。
const globalForScheduler = globalThis as unknown as { __ordineSchedulerStarted?: boolean };
if (!import.meta.env.VITEST && !globalForScheduler.__ordineSchedulerStarted) {
  globalForScheduler.__ordineSchedulerStarted = true;
  routineSchedulerService.start();
}
