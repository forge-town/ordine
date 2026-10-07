import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import type {
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
  DbConnection,
  createAgentActionsDao,
  createAgentApprovalsDao,
  createAgentChangeSetsDao,
  createAgentControlRepository,
  createAgentThreadsDao,
  createJobTracesDao,
  createPipelineAgentMessagesDao,
} from "@repo/models";
import {
  AgentPatchSchema,
  AgentSchema,
  CreateConnectorSchema,
  CreateProjectSchema,
  CreateRoutineSchema,
  CreateSkillSchema,
  DistillationConfigSchema,
  DistillationModeSchema,
  DistillationSourceTypeSchema,
  OperationSchema,
  PipelineStatusSchema,
  UpdateConnectorSchema,
  UpdateProjectSchema,
  UpdateRoutineSchema,
  UpdateSkillSchema,
  type AgentResourceRef,
  type AgentResourceType,
  type AgentControlEvent,
  type AgentControlToolResult,
  type PipelineGraphSnapshot,
} from "@repo/schemas";
import type { Result } from "neverthrow";
import type { createAgentsService } from "../agentsService";
import type { createConnectorsService } from "../connectorsService";
import type { createDistillationsService } from "../distillationsService";
import type { createOperationsService } from "../operationsService";
import type { createPipelineAssetsService } from "../pipelineAssetsService";
import type { createPipelinesService } from "../pipelinesService";
import type { createProjectsService } from "../projectsService";
import type { createRoutinesService } from "../routinesService";
import type { createSkillsService } from "../skillsService";
import type {
  findAgentControlTool,
  AgentControlInvocationContext,
  AgentControlToolName,
  AddNodeInputSchema,
  ConnectNodesInputSchema,
  DisconnectEdgeInputSchema,
  ReconnectEdgeInputSchema,
  RemoveNodeInputSchema,
  UpdateNodeInputSchema,
} from "@repo/agent-control";

import type {
  createCanvasControl,
  CanvasReadValue,
  CanvasControlError,
} from "./helpers/canvasControl";

import type {
  createExecutionPreflight,
  ExecutionPreflightValue,
  ExecutionPreflightError,
} from "./helpers/executionPreflight";

import type { createResourceControl, ResourceControlValue } from "./helpers/resourceControl";
import type { AgentControlServiceOptions } from "./agentControl.service";
export const APPROVAL_TTL_MS = 10 * 60 * 1000;
export const MAX_TRACE_MESSAGE_CHARS = 4000;
export type DomainError = {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
  nodeId?: string;
  portId?: string;
};
export type DomainValue = ResourceControlValue | CanvasReadValue;
export type ExecutionResult = Result<Record<string, unknown>, Error>;
export const preparedRunTools = new Set<string>([
  "ordine.prepare_pipeline_run",
  "ordine.prepare_operation_run",
  "ordine.prepare_routine_run",
]);
export type PersistedAction = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createAgentActionsDao>["findById"]>>
>;
export type InvocationState = {
  actionId: string | null;
  runId: string | null;
  toolName: string | null;
  resources: AgentResourceRef[];
};
export interface AgentControlServiceBindings {
  db: DbConnection;
  options: AgentControlServiceOptions;
  actionsDao: ReturnType<typeof createAgentActionsDao>;
  approvalsDao: ReturnType<typeof createAgentApprovalsDao>;
  changeSetsDao: ReturnType<typeof createAgentChangeSetsDao>;
  threadsDao: ReturnType<typeof createAgentThreadsDao>;
  jobsDao: ReturnType<typeof createJobsDao>;
  tracesDao: ReturnType<typeof createJobTracesDao>;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
  repository: ReturnType<typeof createAgentControlRepository>;
  resources: ReturnType<typeof createResourceControl>;
  canvas: ReturnType<typeof createCanvasControl>;
  preflight: ReturnType<typeof createExecutionPreflight>;
  canvasMutationQueues: Map<string, Promise<void>>;
  serializeCanvasMutation: <T>(key: string, operation: () => Promise<T>) => Promise<T>;
  emit: (
    runId: string | null,
    payload: Record<string, unknown> & { type: AgentControlEvent["type"] },
  ) => Promise<void>;
  ensureThread: (context: AgentControlInvocationContext) => Promise<string>;
  persistFailure: (argument0: {
    actionId: string;
    toolName: string;
    runId: string | null;
    error: DomainError;
    resources?: AgentResourceRef[];
  }) => Promise<AgentControlToolResult>;
  executionPreflight: (
    name: AgentControlToolName,
    input: unknown,
  ) => Promise<Result<ExecutionPreflightValue | null, DomainError>>;
  executeDomainTool: (
    name: AgentControlToolName,
    input: unknown,
    threadId: string,
    actionId: string,
  ) => Promise<Result<DomainValue, DomainError>>;
  requestApproval: (argument0: {
    actionId: string;
    definition: NonNullable<ReturnType<typeof findAgentControlTool>>;
    input: unknown;
    threadId: string;
    runId: string | null;
    target: AgentResourceRef | null;
    redactedInput: Record<string, unknown>;
    reasons: string[];
  }) => Promise<AgentControlToolResult>;
  invokeInternal: (
    name: string,
    rawInput: unknown,
    context: AgentControlInvocationContext,
    invocation: InvocationState,
  ) => Promise<AgentControlToolResult>;
}

export const PipelineMetadataCreateSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
    projectId: z.string().min(1).nullable().optional(),
    name: z.string().min(1),
    description: z.string().default(""),
    sharedContext: z.string().default(""),
    status: PipelineStatusSchema.default("draft"),
    tags: z.array(z.string()).max(50).default([]),
    timeoutMs: z.number().int().positive().nullable().default(null),
  })
  .strict();
export const PipelineMetadataUpdateSchema = PipelineMetadataCreateSchema.omit({
  id: true,
}).partial();
export const OperationCreateSchema = OperationSchema.omit({ meta: true });
export const OperationUpdateSchema = OperationCreateSchema.omit({ id: true }).partial();
export const AgentCreateSchema = AgentSchema.omit({ meta: true });
export const DistillationCreateSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
    title: z.string().min(1),
    summary: z.string().default(""),
    sourceType: DistillationSourceTypeSchema.default("manual"),
    sourceId: z.string().min(1).nullable().default(null),
    sourceLabel: z.string().default(""),
    mode: DistillationModeSchema.default("pipeline"),
    config: DistillationConfigSchema.default({ objective: "" }),
  })
  .strict();
export const DistillationUpdateSchema = DistillationCreateSchema.omit({ id: true }).partial();
export const PipelineAssetCreateSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
    pipelineId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(""),
    tags: z.array(z.string().min(1)).min(1).max(50),
  })
  .strict();
export const PipelineAssetUpdateSchema = PipelineAssetCreateSchema.omit({
  id: true,
  pipelineId: true,
})
  .partial()
  .strict();
export const createSchemas = {
  project: CreateProjectSchema.extend({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
  }).strict(),
  pipeline: PipelineMetadataCreateSchema,
  operation: OperationCreateSchema,
  skill: CreateSkillSchema.extend({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
  }).strict(),
  agent: AgentCreateSchema,
  connector: CreateConnectorSchema.extend({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
  }).strict(),
  routine: CreateRoutineSchema.and(
    z.object({
      id: z
        .string()
        .min(1)
        .default(() => randomUUID()),
    }),
  ),
  distillation: DistillationCreateSchema,
  "pipeline-asset": PipelineAssetCreateSchema,
} as const;
export const updateSchemas = {
  project: UpdateProjectSchema.strict(),
  pipeline: PipelineMetadataUpdateSchema,
  operation: OperationUpdateSchema,
  skill: UpdateSkillSchema.strict(),
  agent: AgentPatchSchema.strict(),
  connector: UpdateConnectorSchema.strict(),
  routine: UpdateRoutineSchema,
  distillation: DistillationUpdateSchema,
  "pipeline-asset": PipelineAssetUpdateSchema,
} as const;
export interface ResourceControlBindings {
  db: DbConnection;
  daos: {
    project: ReturnType<typeof createProjectsDao>;
    pipeline: ReturnType<typeof createPipelinesDao>;
    operation: ReturnType<typeof createOperationsDao>;
    skill: ReturnType<typeof createSkillsDao>;
    agent: ReturnType<typeof createAgentsDao>;
    connector: ReturnType<typeof createConnectorsDao>;
    routine: ReturnType<typeof createRoutinesDao>;
    distillation: ReturnType<typeof createDistillationsDao>;
    "pipeline-asset": ReturnType<typeof createPipelineAssetsDao>;
    job: ReturnType<typeof createJobsDao>;
  };
  services: {
    project: ReturnType<typeof createProjectsService>;
    pipeline: ReturnType<typeof createPipelinesService>;
    operation: ReturnType<typeof createOperationsService>;
    skill: ReturnType<typeof createSkillsService>;
    agent: ReturnType<typeof createAgentsService>;
    connector: ReturnType<typeof createConnectorsService>;
    routine: ReturnType<typeof createRoutinesService>;
    distillation: ReturnType<typeof createDistillationsService>;
    "pipeline-asset": ReturnType<typeof createPipelineAssetsService>;
  };
  list: (type: AgentResourceType) => Promise<unknown[]>;
  findById: (type: AgentResourceType, id: string) => Promise<unknown | null>;
}

export type CanvasMutationToolName =
  | "ordine.add_node"
  | "ordine.update_node"
  | "ordine.remove_node"
  | "ordine.connect_nodes"
  | "ordine.disconnect_edge"
  | "ordine.reconnect_edge";
export type CanvasMutationInput =
  | z.infer<typeof AddNodeInputSchema>
  | z.infer<typeof UpdateNodeInputSchema>
  | z.infer<typeof RemoveNodeInputSchema>
  | z.infer<typeof ConnectNodesInputSchema>
  | z.infer<typeof DisconnectEdgeInputSchema>
  | z.infer<typeof ReconnectEdgeInputSchema>;
export interface CanvasControlBindings {
  db: DbConnection;
  digestArguments: (input: unknown) => string;
  actionsDao: ReturnType<typeof createAgentActionsDao>;
  changeSetsDao: ReturnType<typeof createAgentChangeSetsDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
  repository: ReturnType<typeof createAgentControlRepository>;
  validateOperationReferences: (
    snapshot: PipelineGraphSnapshot,
    actionId: string,
  ) => Promise<Result<void, CanvasControlError>>;
  validateSnapshot: (
    snapshot: PipelineGraphSnapshot,
    actionId: string,
  ) => Promise<Result<void, CanvasControlError>>;
  resolveSnapshot: (argument0: {
    pipelineId: string;
    threadId?: string | null;
    changeSetId?: string;
  }) => Promise<{
    pipeline: {
      id: string;
      projectId: string | null;
      name: string;
      description: string;
      sharedContext: string;
      status: "draft" | "ready" | "running" | "completed" | "failed" | "archived";
      version: number;
      tags: string[];
      nodes: {
        id: string;
        type:
          | "file"
          | "folder"
          | "github-project"
          | "prompt"
          | "operation"
          | "compound"
          | "output-project-path"
          | "output-local-path"
          | "decision";
        position: { x: number; y: number };
        data:
          | {
              label: string;
              nodeType: "compound";
              childNodeIds: string[];
              compoundKind?: "custom" | "verify" | "council" | "delegation" | undefined;
              boundaryEdges?:
                | {
                    id: string;
                    source: string;
                    target: string;
                    sourceHandle?: string | null | undefined;
                    targetHandle?: string | null | undefined;
                    data?:
                      | {
                          label: string;
                          dataContract?:
                            | {
                                mappings: {
                                  fromField: string;
                                  toInput: string;
                                  enabled: boolean;
                                  type?: string | undefined;
                                }[];
                              }
                            | undefined;
                          condition?:
                            | { expression: string; fallbackTarget?: string | undefined }
                            | undefined;
                          transform?:
                            | { steps: { type: string; config: Record<string, unknown> }[] }
                            | undefined;
                          qualityGate?:
                            | {
                                criteria: string;
                                onFail: "retry" | "skip" | "fail";
                                maxRetries?: number | undefined;
                              }
                            | undefined;
                          handoff?:
                            | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                            | undefined;
                        }
                      | undefined;
                  }[]
                | undefined;
              childEdges?:
                | {
                    id: string;
                    source: string;
                    target: string;
                    sourceHandle?: string | null | undefined;
                    targetHandle?: string | null | undefined;
                    data?:
                      | {
                          label: string;
                          dataContract?:
                            | {
                                mappings: {
                                  fromField: string;
                                  toInput: string;
                                  enabled: boolean;
                                  type?: string | undefined;
                                }[];
                              }
                            | undefined;
                          condition?:
                            | { expression: string; fallbackTarget?: string | undefined }
                            | undefined;
                          transform?:
                            | { steps: { type: string; config: Record<string, unknown> }[] }
                            | undefined;
                          qualityGate?:
                            | {
                                criteria: string;
                                onFail: "retry" | "skip" | "fail";
                                maxRetries?: number | undefined;
                              }
                            | undefined;
                          handoff?:
                            | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                            | undefined;
                        }
                      | undefined;
                  }[]
                | undefined;
              description?: string | undefined;
              verifyConfig?: { maxRounds: number; criteria: string } | undefined;
              councilConfig?:
                | {
                    roles: { name: string; perspective: string; agentId?: string | undefined }[];
                    convergenceCondition: string;
                  }
                | undefined;
              delegationConfig?: { splitStrategy: string; mergeStrategy: string } | undefined;
            }
          | {
              label: string;
              nodeType: "decision";
              selectMode: "single" | "multi";
              instruction?: string | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "file";
              filePath: string;
              language?: string | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "folder";
              folderPath: string;
              excludedPaths?: string[] | undefined;
              disclosureMode?: "tree" | "full" | "files-only" | undefined;
              includedExtensions?: string[] | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "github-project";
              owner: string;
              repo: string;
              sourceType?: "github" | "local" | undefined;
              accessMode?: "clone" | "remote" | undefined;
              branch?: string | undefined;
              description?: string | undefined;
              isPrivate?: boolean | undefined;
              githubProjectId?: string | undefined;
              localPath?: string | undefined;
              disclosureMode?: "tree" | "full" | "files-only" | undefined;
              excludedPaths?: string[] | undefined;
            }
          | {
              label: string;
              nodeType: "operation";
              operationId: string;
              operationName: string;
              status:
                | "running"
                | "failed"
                | "idle"
                | "queued"
                | "waitingForUser"
                | "retrying"
                | "done"
                | "skipped"
                | "cancelled";
              config?: Record<string, string | number | boolean> | undefined;
              notes?: string | undefined;
              agentId?: string | undefined;
              agentRuntime?:
                | "claude-code"
                | "codex"
                | "hermes"
                | "deepseek-harness"
                | "mastra"
                | "mistral-vibe"
                | "openclaw"
                | "pi-agent"
                | "opencode"
                | "kimi-code"
                | "deepseek-reasonix"
                | "kiro"
                | "trae"
                | undefined;
              executionOverrides?:
                | {
                    runtimeConfigId?: string | undefined;
                    model?: string | undefined;
                    reasoningEffort?: string | undefined;
                    speed?: string | undefined;
                    firstOutputTimeoutMs?: number | undefined;
                    inactivityTimeoutMs?: number | undefined;
                  }
                | undefined;
              checkpoint?: boolean | undefined;
              loopEnabled?: boolean | undefined;
              maxLoopCount?: number | undefined;
              loopConditionPrompt?: string | undefined;
            }
          | {
              label: string;
              nodeType: "output-project-path";
              path: string;
              projectId?: string | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "output-local-path";
              localPath: string;
              storage?: "artifact" | undefined;
              outputFileName?: string | undefined;
              outputMode?: "overwrite" | "error_if_exists" | "auto_rename" | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "prompt";
              prompt: string;
              valueType?: "json" | "text" | undefined;
              description?: string | undefined;
            };
        metaType?: "object" | "output" | "operation" | "decision" | undefined;
        parentId?: string | undefined;
      }[];
      edges: {
        id: string;
        source: string;
        target: string;
        sourceHandle?: string | null | undefined;
        targetHandle?: string | null | undefined;
        data?:
          | {
              label: string;
              dataContract?:
                | {
                    mappings: {
                      fromField: string;
                      toInput: string;
                      enabled: boolean;
                      type?: string | undefined;
                    }[];
                  }
                | undefined;
              condition?: { expression: string; fallbackTarget?: string | undefined } | undefined;
              transform?:
                | { steps: { type: string; config: Record<string, unknown> }[] }
                | undefined;
              qualityGate?:
                | {
                    criteria: string;
                    onFail: "retry" | "skip" | "fail";
                    maxRetries?: number | undefined;
                  }
                | undefined;
              handoff?: { kind: "handoff"; sourcePortId: string; targetPortId: string } | undefined;
            }
          | undefined;
      }[];
      timeoutMs: number | null;
      createdAt: Date;
      updatedAt: Date;
    };
    changeSet: {
      id: string;
      threadId: string;
      runId: string | null;
      actor: "local-owner";
      kind: "agent-edit" | "revert" | "redo";
      originChangeSetId: string | null;
      targetType: string;
      targetId: string;
      baseVersion: number;
      revision: number;
      appliedVersion: number | null;
      status:
        | "ready"
        | "drafting"
        | "applying"
        | "committed"
        | "rejected"
        | "rolled_back"
        | "reverted"
        | "conflicted";
      baseSnapshot: {
        nodes: {
          [x: string]: unknown;
          id: string;
          type:
            | "file"
            | "folder"
            | "github-project"
            | "prompt"
            | "operation"
            | "compound"
            | "output-project-path"
            | "output-local-path"
            | "decision";
          position: { x: number; y: number };
          data:
            | {
                label: string;
                nodeType: "compound";
                childNodeIds: string[];
                compoundKind?: "custom" | "verify" | "council" | "delegation" | undefined;
                boundaryEdges?:
                  | {
                      id: string;
                      source: string;
                      target: string;
                      sourceHandle?: string | null | undefined;
                      targetHandle?: string | null | undefined;
                      data?:
                        | {
                            label: string;
                            dataContract?:
                              | {
                                  mappings: {
                                    fromField: string;
                                    toInput: string;
                                    enabled: boolean;
                                    type?: string | undefined;
                                  }[];
                                }
                              | undefined;
                            condition?:
                              | { expression: string; fallbackTarget?: string | undefined }
                              | undefined;
                            transform?:
                              | { steps: { type: string; config: Record<string, unknown> }[] }
                              | undefined;
                            qualityGate?:
                              | {
                                  criteria: string;
                                  onFail: "retry" | "skip" | "fail";
                                  maxRetries?: number | undefined;
                                }
                              | undefined;
                            handoff?:
                              | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                              | undefined;
                          }
                        | undefined;
                    }[]
                  | undefined;
                childEdges?:
                  | {
                      id: string;
                      source: string;
                      target: string;
                      sourceHandle?: string | null | undefined;
                      targetHandle?: string | null | undefined;
                      data?:
                        | {
                            label: string;
                            dataContract?:
                              | {
                                  mappings: {
                                    fromField: string;
                                    toInput: string;
                                    enabled: boolean;
                                    type?: string | undefined;
                                  }[];
                                }
                              | undefined;
                            condition?:
                              | { expression: string; fallbackTarget?: string | undefined }
                              | undefined;
                            transform?:
                              | { steps: { type: string; config: Record<string, unknown> }[] }
                              | undefined;
                            qualityGate?:
                              | {
                                  criteria: string;
                                  onFail: "retry" | "skip" | "fail";
                                  maxRetries?: number | undefined;
                                }
                              | undefined;
                            handoff?:
                              | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                              | undefined;
                          }
                        | undefined;
                    }[]
                  | undefined;
                description?: string | undefined;
                verifyConfig?: { maxRounds: number; criteria: string } | undefined;
                councilConfig?:
                  | {
                      roles: { name: string; perspective: string; agentId?: string | undefined }[];
                      convergenceCondition: string;
                    }
                  | undefined;
                delegationConfig?: { splitStrategy: string; mergeStrategy: string } | undefined;
              }
            | {
                label: string;
                nodeType: "decision";
                selectMode: "single" | "multi";
                instruction?: string | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "file";
                filePath: string;
                language?: string | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "folder";
                folderPath: string;
                excludedPaths?: string[] | undefined;
                disclosureMode?: "tree" | "full" | "files-only" | undefined;
                includedExtensions?: string[] | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "github-project";
                owner: string;
                repo: string;
                sourceType?: "github" | "local" | undefined;
                accessMode?: "clone" | "remote" | undefined;
                branch?: string | undefined;
                description?: string | undefined;
                isPrivate?: boolean | undefined;
                githubProjectId?: string | undefined;
                localPath?: string | undefined;
                disclosureMode?: "tree" | "full" | "files-only" | undefined;
                excludedPaths?: string[] | undefined;
              }
            | {
                label: string;
                nodeType: "operation";
                operationId: string;
                operationName: string;
                status:
                  | "running"
                  | "failed"
                  | "idle"
                  | "queued"
                  | "waitingForUser"
                  | "retrying"
                  | "done"
                  | "skipped"
                  | "cancelled";
                config?: Record<string, string | number | boolean> | undefined;
                notes?: string | undefined;
                agentId?: string | undefined;
                agentRuntime?:
                  | "claude-code"
                  | "codex"
                  | "hermes"
                  | "deepseek-harness"
                  | "mastra"
                  | "mistral-vibe"
                  | "openclaw"
                  | "pi-agent"
                  | "opencode"
                  | "kimi-code"
                  | "deepseek-reasonix"
                  | "kiro"
                  | "trae"
                  | undefined;
                executionOverrides?:
                  | {
                      runtimeConfigId?: string | undefined;
                      model?: string | undefined;
                      reasoningEffort?: string | undefined;
                      speed?: string | undefined;
                      firstOutputTimeoutMs?: number | undefined;
                      inactivityTimeoutMs?: number | undefined;
                    }
                  | undefined;
                checkpoint?: boolean | undefined;
                loopEnabled?: boolean | undefined;
                maxLoopCount?: number | undefined;
                loopConditionPrompt?: string | undefined;
              }
            | {
                label: string;
                nodeType: "output-project-path";
                path: string;
                projectId?: string | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "output-local-path";
                localPath: string;
                storage?: "artifact" | undefined;
                outputFileName?: string | undefined;
                outputMode?: "overwrite" | "error_if_exists" | "auto_rename" | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "prompt";
                prompt: string;
                valueType?: "json" | "text" | undefined;
                description?: string | undefined;
              };
          metaType?: "object" | "output" | "operation" | "decision" | undefined;
          parentId?: string | undefined;
        }[];
        edges: {
          [x: string]: unknown;
          id: string;
          source: string;
          target: string;
          sourceHandle?: string | null | undefined;
          targetHandle?: string | null | undefined;
          data?:
            | {
                label: string;
                dataContract?:
                  | {
                      mappings: {
                        fromField: string;
                        toInput: string;
                        enabled: boolean;
                        type?: string | undefined;
                      }[];
                    }
                  | undefined;
                condition?: { expression: string; fallbackTarget?: string | undefined } | undefined;
                transform?:
                  | { steps: { type: string; config: Record<string, unknown> }[] }
                  | undefined;
                qualityGate?:
                  | {
                      criteria: string;
                      onFail: "retry" | "skip" | "fail";
                      maxRetries?: number | undefined;
                    }
                  | undefined;
                handoff?:
                  | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                  | undefined;
              }
            | undefined;
        }[];
      } | null;
      draftSnapshot: {
        nodes: {
          [x: string]: unknown;
          id: string;
          type:
            | "file"
            | "folder"
            | "github-project"
            | "prompt"
            | "operation"
            | "compound"
            | "output-project-path"
            | "output-local-path"
            | "decision";
          position: { x: number; y: number };
          data:
            | {
                label: string;
                nodeType: "compound";
                childNodeIds: string[];
                compoundKind?: "custom" | "verify" | "council" | "delegation" | undefined;
                boundaryEdges?:
                  | {
                      id: string;
                      source: string;
                      target: string;
                      sourceHandle?: string | null | undefined;
                      targetHandle?: string | null | undefined;
                      data?:
                        | {
                            label: string;
                            dataContract?:
                              | {
                                  mappings: {
                                    fromField: string;
                                    toInput: string;
                                    enabled: boolean;
                                    type?: string | undefined;
                                  }[];
                                }
                              | undefined;
                            condition?:
                              | { expression: string; fallbackTarget?: string | undefined }
                              | undefined;
                            transform?:
                              | { steps: { type: string; config: Record<string, unknown> }[] }
                              | undefined;
                            qualityGate?:
                              | {
                                  criteria: string;
                                  onFail: "retry" | "skip" | "fail";
                                  maxRetries?: number | undefined;
                                }
                              | undefined;
                            handoff?:
                              | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                              | undefined;
                          }
                        | undefined;
                    }[]
                  | undefined;
                childEdges?:
                  | {
                      id: string;
                      source: string;
                      target: string;
                      sourceHandle?: string | null | undefined;
                      targetHandle?: string | null | undefined;
                      data?:
                        | {
                            label: string;
                            dataContract?:
                              | {
                                  mappings: {
                                    fromField: string;
                                    toInput: string;
                                    enabled: boolean;
                                    type?: string | undefined;
                                  }[];
                                }
                              | undefined;
                            condition?:
                              | { expression: string; fallbackTarget?: string | undefined }
                              | undefined;
                            transform?:
                              | { steps: { type: string; config: Record<string, unknown> }[] }
                              | undefined;
                            qualityGate?:
                              | {
                                  criteria: string;
                                  onFail: "retry" | "skip" | "fail";
                                  maxRetries?: number | undefined;
                                }
                              | undefined;
                            handoff?:
                              | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                              | undefined;
                          }
                        | undefined;
                    }[]
                  | undefined;
                description?: string | undefined;
                verifyConfig?: { maxRounds: number; criteria: string } | undefined;
                councilConfig?:
                  | {
                      roles: { name: string; perspective: string; agentId?: string | undefined }[];
                      convergenceCondition: string;
                    }
                  | undefined;
                delegationConfig?: { splitStrategy: string; mergeStrategy: string } | undefined;
              }
            | {
                label: string;
                nodeType: "decision";
                selectMode: "single" | "multi";
                instruction?: string | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "file";
                filePath: string;
                language?: string | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "folder";
                folderPath: string;
                excludedPaths?: string[] | undefined;
                disclosureMode?: "tree" | "full" | "files-only" | undefined;
                includedExtensions?: string[] | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "github-project";
                owner: string;
                repo: string;
                sourceType?: "github" | "local" | undefined;
                accessMode?: "clone" | "remote" | undefined;
                branch?: string | undefined;
                description?: string | undefined;
                isPrivate?: boolean | undefined;
                githubProjectId?: string | undefined;
                localPath?: string | undefined;
                disclosureMode?: "tree" | "full" | "files-only" | undefined;
                excludedPaths?: string[] | undefined;
              }
            | {
                label: string;
                nodeType: "operation";
                operationId: string;
                operationName: string;
                status:
                  | "running"
                  | "failed"
                  | "idle"
                  | "queued"
                  | "waitingForUser"
                  | "retrying"
                  | "done"
                  | "skipped"
                  | "cancelled";
                config?: Record<string, string | number | boolean> | undefined;
                notes?: string | undefined;
                agentId?: string | undefined;
                agentRuntime?:
                  | "claude-code"
                  | "codex"
                  | "hermes"
                  | "deepseek-harness"
                  | "mastra"
                  | "mistral-vibe"
                  | "openclaw"
                  | "pi-agent"
                  | "opencode"
                  | "kimi-code"
                  | "deepseek-reasonix"
                  | "kiro"
                  | "trae"
                  | undefined;
                executionOverrides?:
                  | {
                      runtimeConfigId?: string | undefined;
                      model?: string | undefined;
                      reasoningEffort?: string | undefined;
                      speed?: string | undefined;
                      firstOutputTimeoutMs?: number | undefined;
                      inactivityTimeoutMs?: number | undefined;
                    }
                  | undefined;
                checkpoint?: boolean | undefined;
                loopEnabled?: boolean | undefined;
                maxLoopCount?: number | undefined;
                loopConditionPrompt?: string | undefined;
              }
            | {
                label: string;
                nodeType: "output-project-path";
                path: string;
                projectId?: string | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "output-local-path";
                localPath: string;
                storage?: "artifact" | undefined;
                outputFileName?: string | undefined;
                outputMode?: "overwrite" | "error_if_exists" | "auto_rename" | undefined;
                description?: string | undefined;
              }
            | {
                label: string;
                nodeType: "prompt";
                prompt: string;
                valueType?: "json" | "text" | undefined;
                description?: string | undefined;
              };
          metaType?: "object" | "output" | "operation" | "decision" | undefined;
          parentId?: string | undefined;
        }[];
        edges: {
          [x: string]: unknown;
          id: string;
          source: string;
          target: string;
          sourceHandle?: string | null | undefined;
          targetHandle?: string | null | undefined;
          data?:
            | {
                label: string;
                dataContract?:
                  | {
                      mappings: {
                        fromField: string;
                        toInput: string;
                        enabled: boolean;
                        type?: string | undefined;
                      }[];
                    }
                  | undefined;
                condition?: { expression: string; fallbackTarget?: string | undefined } | undefined;
                transform?:
                  | { steps: { type: string; config: Record<string, unknown> }[] }
                  | undefined;
                qualityGate?:
                  | {
                      criteria: string;
                      onFail: "retry" | "skip" | "fail";
                      maxRetries?: number | undefined;
                    }
                  | undefined;
                handoff?:
                  | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                  | undefined;
              }
            | undefined;
        }[];
      } | null;
      committedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    snapshot: {
      nodes: {
        id: string;
        type:
          | "file"
          | "folder"
          | "github-project"
          | "prompt"
          | "operation"
          | "compound"
          | "output-project-path"
          | "output-local-path"
          | "decision";
        position: { x: number; y: number };
        data:
          | {
              label: string;
              nodeType: "compound";
              childNodeIds: string[];
              compoundKind?: "custom" | "verify" | "council" | "delegation" | undefined;
              boundaryEdges?:
                | {
                    id: string;
                    source: string;
                    target: string;
                    sourceHandle?: string | null | undefined;
                    targetHandle?: string | null | undefined;
                    data?:
                      | {
                          label: string;
                          dataContract?:
                            | {
                                mappings: {
                                  fromField: string;
                                  toInput: string;
                                  enabled: boolean;
                                  type?: string | undefined;
                                }[];
                              }
                            | undefined;
                          condition?:
                            | { expression: string; fallbackTarget?: string | undefined }
                            | undefined;
                          transform?:
                            | { steps: { type: string; config: Record<string, unknown> }[] }
                            | undefined;
                          qualityGate?:
                            | {
                                criteria: string;
                                onFail: "retry" | "skip" | "fail";
                                maxRetries?: number | undefined;
                              }
                            | undefined;
                          handoff?:
                            | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                            | undefined;
                        }
                      | undefined;
                  }[]
                | undefined;
              childEdges?:
                | {
                    id: string;
                    source: string;
                    target: string;
                    sourceHandle?: string | null | undefined;
                    targetHandle?: string | null | undefined;
                    data?:
                      | {
                          label: string;
                          dataContract?:
                            | {
                                mappings: {
                                  fromField: string;
                                  toInput: string;
                                  enabled: boolean;
                                  type?: string | undefined;
                                }[];
                              }
                            | undefined;
                          condition?:
                            | { expression: string; fallbackTarget?: string | undefined }
                            | undefined;
                          transform?:
                            | { steps: { type: string; config: Record<string, unknown> }[] }
                            | undefined;
                          qualityGate?:
                            | {
                                criteria: string;
                                onFail: "retry" | "skip" | "fail";
                                maxRetries?: number | undefined;
                              }
                            | undefined;
                          handoff?:
                            | { kind: "handoff"; sourcePortId: string; targetPortId: string }
                            | undefined;
                        }
                      | undefined;
                  }[]
                | undefined;
              description?: string | undefined;
              verifyConfig?: { maxRounds: number; criteria: string } | undefined;
              councilConfig?:
                | {
                    roles: { name: string; perspective: string; agentId?: string | undefined }[];
                    convergenceCondition: string;
                  }
                | undefined;
              delegationConfig?: { splitStrategy: string; mergeStrategy: string } | undefined;
            }
          | {
              label: string;
              nodeType: "decision";
              selectMode: "single" | "multi";
              instruction?: string | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "file";
              filePath: string;
              language?: string | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "folder";
              folderPath: string;
              excludedPaths?: string[] | undefined;
              disclosureMode?: "tree" | "full" | "files-only" | undefined;
              includedExtensions?: string[] | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "github-project";
              owner: string;
              repo: string;
              sourceType?: "github" | "local" | undefined;
              accessMode?: "clone" | "remote" | undefined;
              branch?: string | undefined;
              description?: string | undefined;
              isPrivate?: boolean | undefined;
              githubProjectId?: string | undefined;
              localPath?: string | undefined;
              disclosureMode?: "tree" | "full" | "files-only" | undefined;
              excludedPaths?: string[] | undefined;
            }
          | {
              label: string;
              nodeType: "operation";
              operationId: string;
              operationName: string;
              status:
                | "running"
                | "failed"
                | "idle"
                | "queued"
                | "waitingForUser"
                | "retrying"
                | "done"
                | "skipped"
                | "cancelled";
              config?: Record<string, string | number | boolean> | undefined;
              notes?: string | undefined;
              agentId?: string | undefined;
              agentRuntime?:
                | "claude-code"
                | "codex"
                | "hermes"
                | "deepseek-harness"
                | "mastra"
                | "mistral-vibe"
                | "openclaw"
                | "pi-agent"
                | "opencode"
                | "kimi-code"
                | "deepseek-reasonix"
                | "kiro"
                | "trae"
                | undefined;
              executionOverrides?:
                | {
                    runtimeConfigId?: string | undefined;
                    model?: string | undefined;
                    reasoningEffort?: string | undefined;
                    speed?: string | undefined;
                    firstOutputTimeoutMs?: number | undefined;
                    inactivityTimeoutMs?: number | undefined;
                  }
                | undefined;
              checkpoint?: boolean | undefined;
              loopEnabled?: boolean | undefined;
              maxLoopCount?: number | undefined;
              loopConditionPrompt?: string | undefined;
            }
          | {
              label: string;
              nodeType: "output-project-path";
              path: string;
              projectId?: string | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "output-local-path";
              localPath: string;
              storage?: "artifact" | undefined;
              outputFileName?: string | undefined;
              outputMode?: "overwrite" | "error_if_exists" | "auto_rename" | undefined;
              description?: string | undefined;
            }
          | {
              label: string;
              nodeType: "prompt";
              prompt: string;
              valueType?: "json" | "text" | undefined;
              description?: string | undefined;
            };
        metaType?: "object" | "output" | "operation" | "decision" | undefined;
        parentId?: string | undefined;
      }[];
      edges: {
        id: string;
        source: string;
        target: string;
        sourceHandle?: string | null | undefined;
        targetHandle?: string | null | undefined;
        data?:
          | {
              label: string;
              dataContract?:
                | {
                    mappings: {
                      fromField: string;
                      toInput: string;
                      enabled: boolean;
                      type?: string | undefined;
                    }[];
                  }
                | undefined;
              condition?: { expression: string; fallbackTarget?: string | undefined } | undefined;
              transform?:
                | { steps: { type: string; config: Record<string, unknown> }[] }
                | undefined;
              qualityGate?:
                | {
                    criteria: string;
                    onFail: "retry" | "skip" | "fail";
                    maxRetries?: number | undefined;
                  }
                | undefined;
              handoff?: { kind: "handoff"; sourcePortId: string; targetPortId: string } | undefined;
            }
          | undefined;
      }[];
    };
  } | null>;
}

import type { createCapabilityCatalogService } from "../capabilityCatalogService";

export interface ExecutionPreflightBindings {
  db: DbConnection;
  operationsDao: ReturnType<typeof createOperationsDao>;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
  routinesDao: ReturnType<typeof createRoutinesDao>;
  capabilityCatalog: ReturnType<typeof createCapabilityCatalogService>;
  inspectOperations: (
    operationIds: string[],
  ) => Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>>;
}

export interface AgentThreadsServiceBindings {
  db: DbConnection;
  threadsDao: ReturnType<typeof createAgentThreadsDao>;
  messagesDao: ReturnType<typeof createPipelineAgentMessagesDao>;
}
