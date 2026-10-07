import { z } from "zod/v4";
import type {
  createAgentRuntimesDao,
  createOperationsDao,
  createPipelineAgentAttachmentsDao,
  createPipelineAgentAttachmentsRepository,
  createPipelineAgentContextArtifactsDao,
  createPipelineAgentMessagesDao,
  createPipelineAgentProposalsDao,
  createPipelineAgentSessionsDao,
  createSettingsDao,
  DbConnection,
} from "@repo/models";
import {
  type AgentRuntime,
  PipelineAgentPlanReadinessSchema,
  type PipelineAgentContextArtifactContent,
  type PipelineAgentContextArtifactKind,
  type PipelineAgentMode,
  type PipelineAgentProposal,
  type PipelineGraphSnapshot,
} from "@repo/schemas";

import type { createAgentRunsService } from "../agentRunsService";
import type { createPipelinesService } from "../pipelinesService";
import { withPipelineCanvasSkill } from "../pipelinesService/helpers/pipelineCanvasSkillContext/pipelineCanvasSkillContext.helper";

import type { PIPELINE_AGENT_MAX_ATTACHMENT_BYTES } from "./pipelineAgentSessions.service";
export const PIPELINE_PLANNING_SYSTEM_PROMPT = withPipelineCanvasSkill(
  "You are a fast pipeline planning assistant. Do not use tools. Return exactly one valid JSON object matching the provided output format.",
);
export const PIPELINE_AGENT_PROJECTION_AGENT_ID = "pipeline-agent-projection";
export const RelaxedCanvasEditPlanningResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("question"),
    question: z.string().min(1),
  }),
  z.object({
    type: z.literal("proposal"),
    proposal: z.object({
      mode: z.literal("edit"),
      assistantReply: z.string().min(1).optional(),
      summary: z.string().min(1),
      targetGraphIntent: z.string().optional(),
      majorChanges: z.array(z.string()).default([]),
      assumptions: z.array(z.string()).default([]),
      openQuestions: z.array(z.string()).default([]),
      readiness: PipelineAgentPlanReadinessSchema.default("ready_for_generation"),
    }),
  }),
]);
export type RelaxedCanvasEditPlanningResult = z.infer<typeof RelaxedCanvasEditPlanningResultSchema>;
export type PipelineAgentActivityKind = "planning" | "generating";
export interface PipelineAgentActivity {
  controller: AbortController;
  kind: PipelineAgentActivityKind;
}
export type PipelineAgentSessionsServiceDependencies = {
  agentRunsService?: ReturnType<typeof createAgentRunsService>;
};
export interface PipelineAgentSessionsServiceBindings {
  PIPELINE_AGENT_MAX_ATTACHMENT_BYTES: typeof PIPELINE_AGENT_MAX_ATTACHMENT_BYTES;
  db: DbConnection;
  dependencies: PipelineAgentSessionsServiceDependencies;
  agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  pipelinesService: ReturnType<typeof createPipelinesService>;
  sessionsDao: ReturnType<typeof createPipelineAgentSessionsDao>;
  messagesDao: ReturnType<typeof createPipelineAgentMessagesDao>;
  attachmentsDao: ReturnType<typeof createPipelineAgentAttachmentsDao>;
  attachmentsRepository: ReturnType<typeof createPipelineAgentAttachmentsRepository>;
  contextArtifactsDao: ReturnType<typeof createPipelineAgentContextArtifactsDao>;
  proposalsDao: ReturnType<typeof createPipelineAgentProposalsDao>;
  settingsDao: ReturnType<typeof createSettingsDao>;
  agentRunsServiceState: { local: ReturnType<typeof createAgentRunsService> | undefined };
  getAgentRunsService: () => ReturnType<typeof createAgentRunsService>;
  planningRuns: Map<string, { runId: string; runtimeId: string }>;
  planningCompletions: Map<string, Promise<void>>;
  activeActivities: Map<string, PipelineAgentActivity>;
  beginActivity: (
    sessionId: string,
    kind: PipelineAgentActivityKind,
  ) => { controller: AbortController; kind: PipelineAgentActivityKind };
  assertActivityActive: (sessionId: string, activity: PipelineAgentActivity) => void;
  finishActivity: (sessionId: string, activity: PipelineAgentActivity) => void;
  savePlanningQuestion: (
    sessionId: string,
    question: string,
    activity: PipelineAgentActivity,
  ) => Promise<void>;
  resolveEffectiveRuntime: (input: {
    requestedRuntimeId?: string;
    runtimes: Array<{ id: string; type: AgentRuntime } & Record<string, unknown>>;
    defaultRuntime?: string | null;
  }) => AgentRuntime | null;
  buildPlanningPrompt: (input: {
    artifacts: Awaited<
      ReturnType<PipelineAgentSessionsServiceBindings["contextArtifactsDao"]["findManyBySessionId"]>
    >;
    messages: Awaited<
      ReturnType<PipelineAgentSessionsServiceBindings["messagesDao"]["findManyBySessionId"]>
    >;
    mode: PipelineAgentMode;
    operations: Awaited<
      ReturnType<PipelineAgentSessionsServiceBindings["operationsDao"]["findMany"]>
    >;
    pipelineId: string | null;
    snapshot: PipelineGraphSnapshot | null;
  }) => string;
  persistPlanningOutput: (
    sessionId: string,
    raw: string,
    options?: {
      runtimeId?: string;
      model?: string;
      reasoningEffort?: string;
      speed?: string;
      firstOutputTimeoutMs?: number;
      signal?: AbortSignal;
    },
  ) => Promise<
    | { type: "question"; question: string }
    | { type: "proposal"; proposal: PipelineAgentProposal; proposalId: string }
  >;
  buildGenerationDescription: (
    proposal: Extract<PipelineAgentProposal, { mode: "generate" }>,
  ) => string;
  buildArtifactSummary: (
    artifacts: Awaited<
      ReturnType<PipelineAgentSessionsServiceBindings["contextArtifactsDao"]["findManyBySessionId"]>
    >,
  ) => string;
  decodeText: (bytes: Uint8Array) => string;
  normalizeWhitespace: (value: string) => string;
  decodePdfBinary: (bytes: Uint8Array) => string;
  decodePdfTextBytes: (bytes: number[]) => string;
  readLiteralPdfString: (input: string, startIndex: number) => { nextIndex: number; value: string };
  readHexPdfString: (input: string, startIndex: number) => { value: string; nextIndex: number };
  extractPdfStreamBodies: (bytes: Uint8Array) => string[];
  extractPdfTextTokens: (input: string) => string[];
  extractPdfText: (bytes: Uint8Array) => string;
  extractDocxText: (bytes: Uint8Array) => Promise<string>;
  resolveAttachmentRuntime: (input: {
    requestedRuntimeId?: string;
    runtimes: Array<{ id: string; type: AgentRuntime } & Record<string, unknown>>;
    defaultRuntime?: string | null;
  }) => AgentRuntime | null;
  createImageSummaryArtifact: (input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    runtime: AgentRuntime;
    apiKey?: string;
    model?: string;
  }) => Promise<{
    content: PipelineAgentContextArtifactContent;
    kind: PipelineAgentContextArtifactKind;
  }>;
  getAttachmentKindAndContent: (input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    runtimeId?: string;
  }) => Promise<{
    content: PipelineAgentContextArtifactContent;
    kind: PipelineAgentContextArtifactKind;
  }>;
}
