import {
  createAgentRuntimesDao,
  createOperationsDao,
  createPipelineAgentAttachmentsDao,
  createPipelineAgentAttachmentsRepository,
  createPipelineAgentContextArtifactsDao,
  createPipelineAgentMessagesDao,
  createPipelineAgentProposalsDao,
  createPipelineAgentSessionsDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";

import type { createAgentRunsService } from "../agentRunsService";
import { createPipelinesService } from "../pipelinesService";

export const PIPELINE_AGENT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
import type {
  PipelineAgentActivity,
  PipelineAgentSessionsServiceDependencies,
  PipelineAgentSessionsServiceBindings,
} from "./contracts";

import {
  createGetAgentRunsServiceHelper,
  createBeginActivityHelper,
  createAssertActivityActiveHelper,
  createFinishActivityHelper,
  createSavePlanningQuestionHelper,
  createResolveEffectiveRuntimeHelper,
  createBuildPlanningPromptHelper,
  createPersistPlanningOutputHelper,
  createBuildGenerationDescriptionHelper,
  createBuildArtifactSummaryHelper,
  createDecodeTextHelper,
  createNormalizeWhitespaceHelper,
  createDecodePdfBinaryHelper,
  createDecodePdfTextBytesHelper,
  createReadLiteralPdfStringHelper,
  createReadHexPdfStringHelper,
  createExtractPdfStreamBodiesHelper,
  createExtractPdfTextTokensHelper,
  createExtractPdfTextHelper,
  createExtractDocxTextHelper,
  createResolveAttachmentRuntimeHelper,
  createCreateImageSummaryArtifactHelper,
  createGetAttachmentKindAndContentHelper,
} from "./helpers";

import {
  createCreateSessionMethod,
  createGetLatestSessionForPipelineMethod,
  createAppendMessageMethod,
  createRegisterAttachmentMethod,
  createIngestAttachmentMethod,
  createRemoveAttachmentMethod,
  createSaveContextArtifactMethod,
  createSaveProposalMethod,
  createApproveProposalMethod,
  createSupersedeProposalMethod,
  createGetSessionByIdMethod,
  createCancelSessionMethod,
  createStartPlanningRunMethod,
  createWaitForPlanningRunMethod,
  createGetProjectionRunMethod,
  createPlanSessionMethod,
  createGeneratePipelineFromApprovedProposalMethod,
} from "./methods";

export const createPipelineAgentSessionsService = (
  db: DbConnection,
  dependencies: PipelineAgentSessionsServiceDependencies = {},
) => {
  const serviceBindings: PipelineAgentSessionsServiceBindings = {
    get PIPELINE_AGENT_MAX_ATTACHMENT_BYTES() {
      return PIPELINE_AGENT_MAX_ATTACHMENT_BYTES;
    },
    get db() {
      return db;
    },
    get dependencies() {
      return dependencies;
    },
    get agentRuntimesDao() {
      return agentRuntimesDao;
    },
    get operationsDao() {
      return operationsDao;
    },
    get pipelinesService() {
      return pipelinesService;
    },
    get sessionsDao() {
      return sessionsDao;
    },
    get messagesDao() {
      return messagesDao;
    },
    get attachmentsDao() {
      return attachmentsDao;
    },
    get attachmentsRepository() {
      return attachmentsRepository;
    },
    get contextArtifactsDao() {
      return contextArtifactsDao;
    },
    get proposalsDao() {
      return proposalsDao;
    },
    get settingsDao() {
      return settingsDao;
    },
    get agentRunsServiceState() {
      return agentRunsServiceState;
    },
    get getAgentRunsService() {
      return getAgentRunsService;
    },
    get planningRuns() {
      return planningRuns;
    },
    get planningCompletions() {
      return planningCompletions;
    },
    get activeActivities() {
      return activeActivities;
    },
    get beginActivity() {
      return beginActivity;
    },
    get assertActivityActive() {
      return assertActivityActive;
    },
    get finishActivity() {
      return finishActivity;
    },
    get savePlanningQuestion() {
      return savePlanningQuestion;
    },
    get resolveEffectiveRuntime() {
      return resolveEffectiveRuntime;
    },
    get buildPlanningPrompt() {
      return buildPlanningPrompt;
    },
    get persistPlanningOutput() {
      return persistPlanningOutput;
    },
    get buildGenerationDescription() {
      return buildGenerationDescription;
    },
    get buildArtifactSummary() {
      return buildArtifactSummary;
    },
    get decodeText() {
      return decodeText;
    },
    get normalizeWhitespace() {
      return normalizeWhitespace;
    },
    get decodePdfBinary() {
      return decodePdfBinary;
    },
    get decodePdfTextBytes() {
      return decodePdfTextBytes;
    },
    get readLiteralPdfString() {
      return readLiteralPdfString;
    },
    get readHexPdfString() {
      return readHexPdfString;
    },
    get extractPdfStreamBodies() {
      return extractPdfStreamBodies;
    },
    get extractPdfTextTokens() {
      return extractPdfTextTokens;
    },
    get extractPdfText() {
      return extractPdfText;
    },
    get extractDocxText() {
      return extractDocxText;
    },
    get resolveAttachmentRuntime() {
      return resolveAttachmentRuntime;
    },
    get createImageSummaryArtifact() {
      return createImageSummaryArtifact;
    },
    get getAttachmentKindAndContent() {
      return getAttachmentKindAndContent;
    },
  };

  const agentRuntimesDao = createAgentRuntimesDao(db);
  const operationsDao = createOperationsDao(db);
  const pipelinesService = createPipelinesService(db);
  const sessionsDao = createPipelineAgentSessionsDao(db);
  const messagesDao = createPipelineAgentMessagesDao(db);
  const attachmentsDao = createPipelineAgentAttachmentsDao(db);
  const attachmentsRepository = createPipelineAgentAttachmentsRepository(db);
  const contextArtifactsDao = createPipelineAgentContextArtifactsDao(db);
  const proposalsDao = createPipelineAgentProposalsDao(db);
  const settingsDao = createSettingsDao(db);
  const agentRunsServiceState = {
    local: undefined as ReturnType<typeof createAgentRunsService> | undefined,
  };
  const getAgentRunsService = createGetAgentRunsServiceHelper(serviceBindings);
  const planningRuns = new Map<string, { runId: string; runtimeId: string }>();
  const planningCompletions = new Map<string, Promise<void>>();
  const activeActivities = new Map<string, PipelineAgentActivity>();
  const beginActivity = createBeginActivityHelper(serviceBindings);
  const assertActivityActive = createAssertActivityActiveHelper(serviceBindings);
  const finishActivity = createFinishActivityHelper(serviceBindings);
  const savePlanningQuestion = createSavePlanningQuestionHelper(serviceBindings);
  const resolveEffectiveRuntime = createResolveEffectiveRuntimeHelper(serviceBindings);

  const buildPlanningPrompt = createBuildPlanningPromptHelper(serviceBindings);

  const persistPlanningOutput = createPersistPlanningOutputHelper(serviceBindings);

  const buildGenerationDescription = createBuildGenerationDescriptionHelper(serviceBindings);

  const buildArtifactSummary = createBuildArtifactSummaryHelper(serviceBindings);

  const decodeText = createDecodeTextHelper(serviceBindings);
  const normalizeWhitespace = createNormalizeWhitespaceHelper(serviceBindings);
  const decodePdfBinary = createDecodePdfBinaryHelper(serviceBindings);
  const decodePdfTextBytes = createDecodePdfTextBytesHelper(serviceBindings);
  const readLiteralPdfString = createReadLiteralPdfStringHelper(serviceBindings);
  const readHexPdfString = createReadHexPdfStringHelper(serviceBindings);
  const extractPdfStreamBodies = createExtractPdfStreamBodiesHelper(serviceBindings);
  const extractPdfTextTokens = createExtractPdfTextTokensHelper(serviceBindings);
  const extractPdfText = createExtractPdfTextHelper(serviceBindings);
  const extractDocxText = createExtractDocxTextHelper(serviceBindings);

  const resolveAttachmentRuntime = createResolveAttachmentRuntimeHelper(serviceBindings);

  const createImageSummaryArtifact = createCreateImageSummaryArtifactHelper(serviceBindings);

  const getAttachmentKindAndContent = createGetAttachmentKindAndContentHelper(serviceBindings);

  return {
    createSession: createCreateSessionMethod(serviceBindings),

    getLatestSessionForPipeline: createGetLatestSessionForPipelineMethod(serviceBindings),

    appendMessage: createAppendMessageMethod(serviceBindings),

    registerAttachment: createRegisterAttachmentMethod(serviceBindings),

    ingestAttachment: createIngestAttachmentMethod(serviceBindings),

    removeAttachment: createRemoveAttachmentMethod(serviceBindings),

    saveContextArtifact: createSaveContextArtifactMethod(serviceBindings),

    saveProposal: createSaveProposalMethod(serviceBindings),

    approveProposal: createApproveProposalMethod(serviceBindings),

    supersedeProposal: createSupersedeProposalMethod(serviceBindings),

    getSessionById: createGetSessionByIdMethod(serviceBindings),

    cancelSession: createCancelSessionMethod(serviceBindings),

    startPlanningRun: createStartPlanningRunMethod(serviceBindings),

    waitForPlanningRun: createWaitForPlanningRunMethod(serviceBindings),

    getProjectionRun: createGetProjectionRunMethod(serviceBindings),

    planSession: createPlanSessionMethod(serviceBindings),

    generatePipelineFromApprovedProposal:
      createGeneratePipelineFromApprovedProposalMethod(serviceBindings),
  };
};
