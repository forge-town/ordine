import { db } from "@repo/db";
import {
  configureAgentRunController,
  createCanvasExecutionPublisher,
  createOperationExecutionPublisher,
  createExecutionConfigurationPublisher,
  createAgentsService,
  createAgentRunController,
  createAgentRunsService,
  createAgentRuntimesService,
  createCapabilityHarvestService,
  createCapabilityCatalogService,
  createConnectorsService,
  createConversationMessagesService,
  createDistillationsService,
  createGithubProjectsService,
  createJobsService,
  createOperationsService,
  createPipelineAssetsService,
  createPipelinesService,
  createProjectsService,
  createRefinementsService,
  createRoutinesService,
  createSettingsService,
  createSkillsService,
  createOperationOutputItemTemplatesService,
  createUsageService,
} from "@repo/services";
import { getServerEnv } from "@/integrations/server-env";
import { executionGateway } from "./executionGateway";
import { err } from "neverthrow";

const { BETTER_AUTH_SECRET } = getServerEnv();
const capabilityExecutionOptions = { encryptionSecret: BETTER_AUTH_SECRET };

export const agentsService = createAgentsService(db);
export const agentRunsService = createAgentRunsService(db);
const agentRunController = createAgentRunController(agentRunsService);
configureAgentRunController(agentRunController);
export const agentRuntimesService = createAgentRuntimesService(db);
const executionConfigurationPublisher = createExecutionConfigurationPublisher({
  gateway: executionGateway,
  readRuntimes: () => agentRuntimesService.getAll(),
  readSettings: () => settingsService.get(),
});
export const capabilityHarvestService = createCapabilityHarvestService(db, {
  encryptionSecret: BETTER_AUTH_SECRET,
  // vite SSR 的 module runner 里 process.env 不是普通对象,zod record 校验会拒收;摊开成纯对象
  env: { ...process.env },
});
export const capabilityCatalogService = createCapabilityCatalogService(db);
export const connectorsService = createConnectorsService(db, capabilityExecutionOptions);
export const conversationMessagesService = createConversationMessagesService(db);
export const distillationsService = createDistillationsService(db);
export const githubProjectsService = createGithubProjectsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
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
export const refinementsService = createRefinementsService(db, capabilityExecutionOptions);
export const routinesService = createRoutinesService(db, {
  startRun: async () => err(new Error("旧定时执行入口已停用，请提交 v2 运行请求并确认。")),
});
export const settingsService = createSettingsService(db);
export const skillsService = createSkillsService(db);
export const operationOutputItemTemplatesService = createOperationOutputItemTemplatesService(db);
export const usageService = createUsageService(db);
