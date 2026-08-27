import { randomUUID } from "node:crypto";
import type { z } from "zod/v4";
import {
  AddNodeInputSchema,
  ConnectNodesInputSchema,
  DisconnectEdgeInputSchema,
  ReconnectEdgeInputSchema,
  RemoveNodeInputSchema,
  UpdateNodeInputSchema,
} from "@repo/agent-control";
import {
  createAgentActionsDao,
  createAgentChangeSetsDao,
  createAgentControlRepository,
  createOperationsDao,
  createPipelinesDao,
  type DbConnection,
} from "@repo/models";
import { applyPipelineActions } from "@repo/pipeline-engine";
import {
  AgentControlToolResultSchema,
  PipelineGraphSnapshotSchema,
  PipelineNodeDataSchema,
  type AgentActionStatus,
  type AgentControlRisk,
  type AgentControlToolResult,
  type PipelineAction,
  type PipelineGraphSnapshot,
} from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";

type CanvasMutationToolName =
  | "ordine.add_node"
  | "ordine.update_node"
  | "ordine.remove_node"
  | "ordine.connect_nodes"
  | "ordine.disconnect_edge"
  | "ordine.reconnect_edge";

type CanvasMutationInput =
  | z.infer<typeof AddNodeInputSchema>
  | z.infer<typeof UpdateNodeInputSchema>
  | z.infer<typeof RemoveNodeInputSchema>
  | z.infer<typeof ConnectNodesInputSchema>
  | z.infer<typeof DisconnectEdgeInputSchema>
  | z.infer<typeof ReconnectEdgeInputSchema>;

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

const canvasError = (
  actionId: string,
  code: string,
  message: string,
  retryable = true,
  extras: Pick<CanvasControlError, "field" | "nodeId" | "portId"> = {},
): CanvasControlError => ({ actionId, code, message, retryable, ...extras });

const parseStoredResult = (
  actionId: string,
  status: AgentActionStatus,
  value: Record<string, unknown> | null,
): AgentControlToolResult => {
  const parsed = AgentControlToolResultSchema.safeParse(value);
  if (parsed.success) {
    return status === "succeeded"
      ? AgentControlToolResultSchema.parse({ ...parsed.data, status: "replayed" })
      : parsed.data;
  }

  return AgentControlToolResultSchema.parse({
    actionId,
    status: "failed",
    resources: [],
    summary: "The matching tool call is still incomplete; retry after the current run settles.",
    warnings: [],
    retry: {
      retryable: true,
      code: "ACTION_IN_PROGRESS",
      message: "The matching idempotency key already has an incomplete action.",
    },
  });
};

const changeSetInput = (input: CanvasMutationInput) => ({
  pipelineId: input.pipelineId,
  threadId: input.threadId,
  runId: input.runId ?? null,
  changeSetId: input.changeSetId,
  callId: input.callId,
});

const validateInvocationBinding = ({
  input,
  threadId,
  runId,
  actionId,
}: {
  input: CanvasMutationInput;
  threadId: string;
  runId: string | null;
  actionId: string;
}): Result<void, CanvasControlError> => {
  if (input.threadId !== threadId) {
    return err(
      canvasError(
        actionId,
        "THREAD_BINDING_MISMATCH",
        "The tool input threadId does not match the authenticated Agent thread.",
        false,
        { field: "threadId" },
      ),
    );
  }
  if (input.runId !== undefined && input.runId !== runId) {
    return err(
      canvasError(
        actionId,
        "RUN_BINDING_MISMATCH",
        "The tool input runId does not match the authenticated Agent run.",
        false,
        { field: "runId" },
      ),
    );
  }

  return ok(undefined);
};

const buildMutation = (
  toolName: CanvasMutationToolName,
  input: CanvasMutationInput,
  snapshot: PipelineGraphSnapshot,
  actionId: string,
): Result<{ action: PipelineAction; inverse: PipelineAction[] }, CanvasControlError> => {
  if (toolName === "ordine.add_node") {
    const parsed = AddNodeInputSchema.parse(input);

    return ok({
      action: { type: "addNode", node: parsed.node },
      inverse: [{ type: "removeNode", nodeId: parsed.node.id }],
    });
  }
  if (toolName === "ordine.remove_node") {
    const parsed = RemoveNodeInputSchema.parse(input);
    const node = snapshot.nodes.find((entry) => entry.id === parsed.nodeId);
    if (!node) {
      return err(
        canvasError(actionId, "NODE_NOT_FOUND", `Node "${parsed.nodeId}" was not found.`, true, {
          nodeId: parsed.nodeId,
        }),
      );
    }
    const incidentEdges = snapshot.edges.filter(
      (edge) => edge.source === parsed.nodeId || edge.target === parsed.nodeId,
    );

    return ok({
      action: { type: "removeNode", nodeId: parsed.nodeId },
      inverse: [
        { type: "addNode", node },
        ...incidentEdges.map((edge) => ({ type: "addEdge" as const, edge })),
      ],
    });
  }
  if (toolName === "ordine.connect_nodes") {
    const parsed = ConnectNodesInputSchema.parse(input);

    return ok({
      action: {
        type: "addEdge",
        edge: {
          id: parsed.edgeId,
          source: parsed.source,
          target: parsed.target,
          sourceHandle: parsed.sourceHandle ?? null,
          targetHandle: parsed.targetHandle ?? null,
        },
      },
      inverse: [{ type: "removeEdge", edgeId: parsed.edgeId }],
    });
  }
  if (toolName === "ordine.disconnect_edge") {
    const parsed = DisconnectEdgeInputSchema.parse(input);
    const edge = snapshot.edges.find((entry) => entry.id === parsed.edgeId);
    if (!edge) {
      return err(
        canvasError(actionId, "EDGE_NOT_FOUND", `Edge "${parsed.edgeId}" was not found.`, true),
      );
    }

    return ok({
      action: { type: "removeEdge", edgeId: parsed.edgeId },
      inverse: [{ type: "addEdge", edge }],
    });
  }
  if (toolName === "ordine.reconnect_edge") {
    const parsed = ReconnectEdgeInputSchema.parse(input);
    const edge = snapshot.edges.find((entry) => entry.id === parsed.edgeId);
    if (!edge) {
      return err(
        canvasError(actionId, "EDGE_NOT_FOUND", `Edge "${parsed.edgeId}" was not found.`, true),
      );
    }

    return ok({
      action: {
        type: "reconnectEdge",
        edgeId: parsed.edgeId,
        source: parsed.source,
        target: parsed.target,
        sourceHandle: parsed.sourceHandle ?? null,
        targetHandle: parsed.targetHandle ?? null,
      },
      inverse: [
        {
          type: "reconnectEdge",
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
        },
      ],
    });
  }

  const parsed = UpdateNodeInputSchema.parse(input);
  const node = snapshot.nodes.find((entry) => entry.id === parsed.nodeId);
  if (!node) {
    return err(
      canvasError(actionId, "NODE_NOT_FOUND", `Node "${parsed.nodeId}" was not found.`, true, {
        nodeId: parsed.nodeId,
      }),
    );
  }
  const patch =
    "data" in parsed.patch && Object.keys(parsed.patch).length === 1
      ? parsed.patch.data
      : parsed.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return err(
      canvasError(
        actionId,
        "INVALID_NODE_PATCH",
        "update_node.patch must contain node data fields or a single data object.",
        true,
        { field: "patch" },
      ),
    );
  }
  const nextData = PipelineNodeDataSchema.safeParse({
    ...node.data,
    ...(patch as Record<string, unknown>),
  });
  if (!nextData.success) {
    const issue = nextData.error.issues[0];

    return err(
      canvasError(
        actionId,
        "INVALID_NODE_DATA",
        issue?.message ?? "The node data patch is invalid.",
        true,
        {
          field: issue?.path.length ? `patch.${issue.path.join(".")}` : "patch",
          nodeId: parsed.nodeId,
        },
      ),
    );
  }

  return ok({
    action: { type: "replaceNodeData", nodeId: parsed.nodeId, data: nextData.data },
    inverse: [{ type: "replaceNodeData", nodeId: parsed.nodeId, data: node.data }],
  });
};

const fullGraphActions = (snapshot: PipelineGraphSnapshot): PipelineAction[] => [
  ...snapshot.nodes.map((node) => ({ type: "addNode" as const, node })),
  ...snapshot.edges.map((edge) => ({ type: "addEdge" as const, edge })),
];

const truncateNodeStrings = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") return value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value;
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => truncateNodeStrings(item, depth + 1));
  if (!value || typeof value !== "object" || depth > 5) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, truncateNodeStrings(child, depth + 1)]),
  );
};

export const createCanvasControl = (
  db: DbConnection,
  digestArguments: (input: unknown) => string,
) => {
  const actionsDao = createAgentActionsDao(db);
  const changeSetsDao = createAgentChangeSetsDao(db);
  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const repository = createAgentControlRepository(db);

  const validateOperationReferences = async (
    snapshot: PipelineGraphSnapshot,
    actionId: string,
  ): Promise<Result<void, CanvasControlError>> => {
    const operationNodes = snapshot.nodes.flatMap((node) =>
      node.data.nodeType === "operation" ? [{ node, operationId: node.data.operationId }] : [],
    );
    const operations = await Promise.all(
      operationNodes.map(({ operationId }) => operationsDao.findById(operationId)),
    );
    const missingIndex = operations.findIndex((operation) => !operation);
    if (missingIndex === -1) return ok(undefined);
    const missing = operationNodes[missingIndex]!;

    return err(
      canvasError(
        actionId,
        "OPERATION_NOT_FOUND",
        `Operation "${missing.operationId}" referenced by node "${missing.node.id}" was not found.`,
        true,
        { nodeId: missing.node.id, field: "node.data.operationId" },
      ),
    );
  };

  const validateSnapshot = async (
    snapshot: PipelineGraphSnapshot,
    actionId: string,
  ): Promise<Result<void, CanvasControlError>> => {
    const parsed = PipelineGraphSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];

      return err(
        canvasError(
          actionId,
          "INVALID_CANVAS",
          issue?.message ?? "The Canvas graph is invalid.",
          true,
          { field: issue?.path.join(".") || undefined },
        ),
      );
    }
    const validated = applyPipelineActions({ nodes: [], edges: [] }, fullGraphActions(parsed.data));
    if (validated.isErr()) {
      const issue = validated.error[0]!;

      return err(canvasError(actionId, issue.code, issue.message, true));
    }

    return validateOperationReferences(parsed.data, actionId);
  };

  const resolveSnapshot = async ({
    pipelineId,
    threadId,
    changeSetId,
  }: {
    pipelineId: string;
    threadId?: string | null;
    changeSetId?: string;
  }) => {
    const pipeline = await pipelinesDao.findById(pipelineId);
    if (!pipeline) return null;
    const explicit = changeSetId ? await changeSetsDao.findById(changeSetId) : null;
    const active =
      explicit ??
      (threadId ? await changeSetsDao.findActive(threadId, "pipeline", pipelineId) : null);
    const changeSet =
      active &&
      active.threadId === threadId &&
      active.targetType === "pipeline" &&
      active.targetId === pipelineId
        ? active
        : null;

    return {
      pipeline,
      changeSet,
      snapshot: changeSet?.draftSnapshot ?? { nodes: pipeline.nodes, edges: pipeline.edges },
    };
  };

  return {
    async inspect({
      pipelineId,
      threadId,
      nodeIds,
      cursor,
      limit,
    }: {
      pipelineId: string;
      threadId?: string | null;
      nodeIds?: string[];
      cursor?: string;
      limit: number;
    }): Promise<Result<CanvasReadValue, CanvasControlError>> {
      const actionId = randomUUID();
      const resolved = await resolveSnapshot({ pipelineId, threadId });
      if (!resolved) {
        return err(
          canvasError(actionId, "PIPELINE_NOT_FOUND", `Pipeline "${pipelineId}" was not found.`),
        );
      }
      const offset = cursor ? Number.parseInt(cursor, 10) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0) {
        return err(
          canvasError(actionId, "INVALID_CURSOR", "cursor must be a non-negative integer", true, {
            field: "cursor",
          }),
        );
      }
      const selected = nodeIds?.length
        ? resolved.snapshot.nodes.filter((node) => nodeIds.includes(node.id))
        : resolved.snapshot.nodes.slice(offset, offset + limit);
      const selectedIds = new Set(selected.map((node) => node.id));
      const relatedEdges = resolved.snapshot.edges.filter(
        (edge) => selectedIds.has(edge.source) || selectedIds.has(edge.target),
      );
      const edges = relatedEdges.slice(0, 200);
      const nextOffset = offset + selected.length;
      const warnings = [
        ...(relatedEdges.length > edges.length
          ? [
              `${relatedEdges.length - edges.length} related edges were omitted; narrow nodeIds to inspect them.`,
            ]
          : []),
      ];

      return ok({
        resources: [{ type: "pipeline", id: pipelineId, label: resolved.pipeline.name }],
        summary: `Inspected ${selected.length} of ${resolved.snapshot.nodes.length} Canvas nodes and ${edges.length} related edges.`,
        data: {
          pipeline: {
            id: pipelineId,
            name: resolved.pipeline.name,
            version: resolved.pipeline.version,
          },
          changeSet: resolved.changeSet
            ? {
                id: resolved.changeSet.id,
                status: resolved.changeSet.status,
                baseVersion: resolved.changeSet.baseVersion,
                revision: resolved.changeSet.revision,
              }
            : null,
          nodes: truncateNodeStrings(selected),
          edges: truncateNodeStrings(edges),
          nextCursor:
            !nodeIds?.length && nextOffset < resolved.snapshot.nodes.length
              ? String(nextOffset)
              : null,
          totalNodes: resolved.snapshot.nodes.length,
          totalEdges: resolved.snapshot.edges.length,
        },
        warnings,
      });
    },

    async applyMutation({
      toolName,
      input,
      threadId,
      runId,
      risk,
      redactedInput,
      argumentDigest,
      onStarted,
    }: {
      toolName: CanvasMutationToolName;
      input: CanvasMutationInput;
      threadId: string;
      runId: string | null;
      risk: AgentControlRisk;
      redactedInput: Record<string, unknown>;
      argumentDigest: string;
      onStarted?: (actionId: string) => Promise<void>;
    }): Promise<Result<CanvasMutationValue, CanvasControlError>> {
      const candidateActionId = randomUUID();
      const binding = validateInvocationBinding({
        input,
        threadId,
        runId,
        actionId: candidateActionId,
      });
      if (binding.isErr()) return err(binding.error);
      const metadata = changeSetInput(input);
      const existing = await actionsDao.findByIdempotency(threadId, toolName, metadata.callId);
      if (existing) {
        const persistedDigest = existing.argumentDigest ?? digestArguments(existing.redactedInput);
        if (persistedDigest !== argumentDigest) {
          return err(
            canvasError(
              existing.id,
              "IDEMPOTENCY_ARGUMENT_MISMATCH",
              "callId was already used with different Canvas arguments; retry with a new callId.",
              false,
              { field: "callId" },
            ),
          );
        }
        const stored = parseStoredResult(existing.id, existing.status, existing.result);
        const storedAction = existing.changeSetId
          ? await changeSetsDao.findById(existing.changeSetId)
          : null;

        if (!existing.forwardAction) {
          return err(
            canvasError(
              existing.id,
              "ACTION_REPLAY_UNAVAILABLE",
              "The stored Canvas action predates replay support; inspect the Canvas and retry with a new callId.",
              true,
              { field: "callId" },
            ),
          );
        }

        return storedAction && storedAction.targetId === metadata.pipelineId
          ? ok({
              actionId: existing.id,
              changeSetId: storedAction.id,
              pipelineId: metadata.pipelineId,
              pipelineAction: existing.forwardAction,
              result: stored,
              replayed: true,
            })
          : err(
              canvasError(
                existing.id,
                "IDEMPOTENCY_TARGET_MISMATCH",
                "callId was already used for another Canvas target.",
                false,
                { field: "callId" },
              ),
            );
      }
      const pipeline = await pipelinesDao.findById(metadata.pipelineId);
      if (!pipeline) {
        return err(
          canvasError(
            candidateActionId,
            "PIPELINE_NOT_FOUND",
            `Pipeline "${metadata.pipelineId}" was not found.`,
          ),
        );
      }
      const requested = metadata.changeSetId
        ? await changeSetsDao.findById(metadata.changeSetId)
        : await changeSetsDao.findActive(threadId, "pipeline", metadata.pipelineId);
      if (
        requested &&
        (requested.threadId !== threadId ||
          requested.targetType !== "pipeline" ||
          requested.targetId !== metadata.pipelineId)
      ) {
        return err(
          canvasError(
            candidateActionId,
            "CHANGE_SET_BINDING_MISMATCH",
            "The Change Set does not belong to this thread and Pipeline.",
            false,
            { field: "changeSetId" },
          ),
        );
      }
      const baseSnapshot = {
        nodes: pipeline.nodes,
        edges: pipeline.edges,
      } satisfies PipelineGraphSnapshot;
      const changeSet =
        requested ??
        (await repository.createChangeSet({
          id: randomUUID(),
          threadId,
          runId,
          actor: "local-owner",
          kind: "agent-edit",
          originChangeSetId: null,
          targetType: "pipeline",
          targetId: pipeline.id,
          baseVersion: pipeline.version,
          revision: 0,
          appliedVersion: null,
          status: "drafting",
          baseSnapshot,
          draftSnapshot: baseSnapshot,
          committedAt: null,
        }));
      if (changeSet.status !== "drafting") {
        return err(
          canvasError(
            candidateActionId,
            "CHANGE_SET_NOT_DRAFTING",
            `Change Set ${changeSet.id} is ${changeSet.status}; Apply or Reject it before more edits.`,
            true,
            { field: "changeSetId" },
          ),
        );
      }
      if (pipeline.version !== changeSet.baseVersion) {
        return err(
          canvasError(
            candidateActionId,
            "VERSION_CONFLICT",
            `Pipeline version is ${pipeline.version}, but the draft is based on ${changeSet.baseVersion}.`,
            true,
            { field: "pipelineId" },
          ),
        );
      }
      const actionId = candidateActionId;
      const persistedAction = await actionsDao.createIdempotent({
        id: actionId,
        threadId,
        runId,
        changeSetId: changeSet.id,
        toolName,
        risk,
        status: "started",
        targetType: "pipeline",
        targetId: pipeline.id,
        redactedInput,
        result: null,
        forwardAction: null,
        inverseActions: null,
        idempotencyKey: metadata.callId,
        argumentDigest,
        completedAt: null,
      });
      if (!persistedAction.created) {
        const persistedDigest =
          persistedAction.action.argumentDigest ??
          digestArguments(persistedAction.action.redactedInput);
        if (persistedDigest !== argumentDigest) {
          return err(
            canvasError(
              persistedAction.action.id,
              "IDEMPOTENCY_ARGUMENT_MISMATCH",
              "callId was already used with different Canvas arguments; retry with a new callId.",
              false,
              { field: "callId" },
            ),
          );
        }
        const replayedChangeSet = persistedAction.action.changeSetId
          ? await changeSetsDao.findById(persistedAction.action.changeSetId)
          : null;
        if (
          !replayedChangeSet ||
          replayedChangeSet.targetId !== metadata.pipelineId ||
          !persistedAction.action.forwardAction
        ) {
          return err(
            canvasError(
              persistedAction.action.id,
              "ACTION_IN_PROGRESS",
              "The matching Canvas call is already in progress; retry after it settles.",
              true,
              { field: "callId" },
            ),
          );
        }

        return ok({
          actionId: persistedAction.action.id,
          changeSetId: replayedChangeSet.id,
          pipelineId: metadata.pipelineId,
          pipelineAction: persistedAction.action.forwardAction,
          result: parseStoredResult(
            persistedAction.action.id,
            persistedAction.action.status,
            persistedAction.action.result,
          ),
          replayed: true,
        });
      }
      await onStarted?.(actionId);
      const currentSnapshot = changeSet.draftSnapshot ?? baseSnapshot;
      const mutation = buildMutation(toolName, input, currentSnapshot, actionId);
      if (mutation.isErr()) {
        await actionsDao.update(actionId, {
          status: "failed",
          result: { error: mutation.error },
          completedAt: new Date(),
        });

        return err(mutation.error);
      }
      const applied = applyPipelineActions(currentSnapshot, [mutation.value.action]);
      if (applied.isErr()) {
        const diagnostic = applied.error[0]!;
        const failure = canvasError(actionId, diagnostic.code, diagnostic.message, true);
        await actionsDao.update(actionId, {
          status: "failed",
          result: { error: failure },
          completedAt: new Date(),
        });

        return err(failure);
      }
      const operationValidation = await validateOperationReferences(applied.value, actionId);
      if (operationValidation.isErr()) {
        await actionsDao.update(actionId, {
          status: "failed",
          result: { error: operationValidation.error },
          completedAt: new Date(),
        });

        return err(operationValidation.error);
      }
      const result = AgentControlToolResultSchema.parse({
        actionId,
        status: "succeeded",
        resources: [{ type: "pipeline", id: pipeline.id, label: pipeline.name }],
        summary: `${toolName} updated Change Set ${changeSet.id} at revision ${changeSet.revision + 1}.`,
        warnings: [],
        data: {
          changeSetId: changeSet.id,
          baseVersion: changeSet.baseVersion,
          revision: changeSet.revision + 1,
        },
      });
      const appended = await repository.appendDraftAction({
        changeSetId: changeSet.id,
        expectedRevision: changeSet.revision,
        draftSnapshot: applied.value,
        actionId,
        result,
        forwardAction: mutation.value.action,
        inverseActions: mutation.value.inverse,
      });
      if (appended.type !== "applied") {
        const failure = canvasError(
          actionId,
          appended.type === "revision_conflict"
            ? "CHANGE_SET_REVISION_CONFLICT"
            : "CHANGE_SET_LOST",
          appended.type === "revision_conflict"
            ? "Another Canvas action changed this draft first; inspect the Canvas and retry with a new callId."
            : "The Change Set disappeared while applying this action.",
          true,
          { field: "callId" },
        );
        await actionsDao.update(actionId, {
          status: "failed",
          result: { error: failure },
          completedAt: new Date(),
        });

        return err(failure);
      }

      return ok({
        actionId,
        changeSetId: changeSet.id,
        pipelineId: pipeline.id,
        pipelineAction: mutation.value.action,
        result,
        replayed: false,
      });
    },

    async validate({
      pipelineId,
      threadId,
      changeSetId,
      actionId = randomUUID(),
    }: {
      pipelineId: string;
      threadId: string;
      changeSetId?: string;
      actionId?: string;
    }): Promise<Result<CanvasReadValue, CanvasControlError>> {
      const resolved = await resolveSnapshot({ pipelineId, threadId, changeSetId });
      if (!resolved) {
        return err(
          canvasError(actionId, "PIPELINE_NOT_FOUND", `Pipeline "${pipelineId}" was not found.`),
        );
      }
      if (changeSetId && !resolved.changeSet) {
        return err(
          canvasError(
            actionId,
            "CHANGE_SET_BINDING_MISMATCH",
            "The Change Set does not belong to this thread and Pipeline.",
            false,
            { field: "changeSetId" },
          ),
        );
      }
      const validation = await validateSnapshot(resolved.snapshot, actionId);
      if (validation.isErr()) return err(validation.error);

      return ok({
        resources: [{ type: "pipeline", id: pipelineId, label: resolved.pipeline.name }],
        summary: `Canvas is valid at ${resolved.changeSet ? `Change Set revision ${resolved.changeSet.revision}` : `Pipeline version ${resolved.pipeline.version}`}.`,
        data: {
          valid: true,
          changeSetId: resolved.changeSet?.id ?? null,
          revision: resolved.changeSet?.revision ?? null,
          nodeCount: resolved.snapshot.nodes.length,
          edgeCount: resolved.snapshot.edges.length,
        },
      });
    },

    async finish({
      pipelineId,
      threadId,
      changeSetId,
      expectedVersion,
      actionId,
    }: {
      pipelineId: string;
      threadId: string;
      changeSetId?: string;
      expectedVersion: number;
      actionId: string;
    }): Promise<Result<CanvasReadValue, CanvasControlError>> {
      const resolved = await resolveSnapshot({ pipelineId, threadId, changeSetId });
      if (!resolved || !resolved.changeSet) {
        return err(
          canvasError(
            actionId,
            "CHANGE_SET_NOT_FOUND",
            "No active Canvas Change Set was found.",
            true,
          ),
        );
      }
      const changeSet = resolved.changeSet;
      if (changeSet.status === "ready") {
        const actionCount = (await actionsDao.findManyByChangeSetId(changeSet.id)).filter(
          (action) => action.status === "succeeded",
        ).length;

        return ok({
          resources: [{ type: "pipeline", id: pipelineId, label: resolved.pipeline.name }],
          summary: `Change Set ${changeSet.id} is already ready for Apply.`,
          data: { changeSetId: changeSet.id, baseVersion: changeSet.baseVersion, actionCount },
        });
      }
      if (changeSet.status !== "drafting") {
        return err(
          canvasError(
            actionId,
            "CHANGE_SET_NOT_DRAFTING",
            `Change Set ${changeSet.id} is ${changeSet.status}.`,
            true,
          ),
        );
      }
      if (
        expectedVersion !== changeSet.baseVersion ||
        resolved.pipeline.version !== changeSet.baseVersion
      ) {
        await changeSetsDao.transition(changeSet.id, ["drafting"], { status: "conflicted" });

        return err(
          canvasError(
            actionId,
            "VERSION_CONFLICT",
            `Pipeline version is ${resolved.pipeline.version}; Change Set base version is ${changeSet.baseVersion}. The draft was preserved.`,
            true,
            { field: "expectedVersion" },
          ),
        );
      }
      const validation = await validateSnapshot(resolved.snapshot, actionId);
      if (validation.isErr()) return err(validation.error);
      const ready = await changeSetsDao.transition(changeSet.id, ["drafting"], { status: "ready" });
      if (!ready) {
        return err(
          canvasError(
            actionId,
            "CHANGE_SET_STATE_CONFLICT",
            "The Change Set state changed; inspect and retry.",
            true,
          ),
        );
      }
      const actionCount = (await actionsDao.findManyByChangeSetId(changeSet.id)).filter(
        (action) => action.status === "succeeded",
      ).length;

      return ok({
        resources: [{ type: "pipeline", id: pipelineId, label: resolved.pipeline.name }],
        summary: `Change Set ${changeSet.id} is valid and ready for Apply.`,
        data: { changeSetId: changeSet.id, baseVersion: changeSet.baseVersion, actionCount },
      });
    },
  };
};
