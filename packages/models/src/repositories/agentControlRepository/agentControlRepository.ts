import type {
  AgentActionRecord,
  AgentApprovalRecord,
  AgentChangeSetRecord,
  agentActionsTable,
  agentApprovalsTable,
  agentChangeSetsTable,
} from "@repo/db-schema";
import type { PipelineGraphSnapshot } from "@repo/schemas";
import { createAgentActionsDao } from "../../daos/agentActionsDao";
import { createAgentApprovalsDao } from "../../daos/agentApprovalsDao";
import { createAgentChangeSetsDao } from "../../daos/agentChangeSetsDao";
import { createPipelinesDao } from "../../daos/pipelinesDao";
import type { DbConnection } from "../../types";

type AgentActionInsert = typeof agentActionsTable.$inferInsert;
type AgentApprovalInsert = typeof agentApprovalsTable.$inferInsert;
type AgentChangeSetInsert = typeof agentChangeSetsTable.$inferInsert;

export type AppendDraftActionResult =
  | {
      type: "applied";
      action: AgentActionRecord;
      changeSet: AgentChangeSetRecord;
    }
  | { type: "replayed"; action: AgentActionRecord; changeSet: AgentChangeSetRecord }
  | { type: "revision_conflict" }
  | { type: "change_set_not_found" };

export type ApplyChangeSetResult =
  | {
      type: "applied";
      changeSet: AgentChangeSetRecord;
      previousVersion: number;
      newVersion: number;
    }
  | { type: "version_conflict"; actualVersion: number | null }
  | { type: "invalid_state"; status: AgentChangeSetRecord["status"] }
  | { type: "change_set_not_found" };

export type CompensateChangeSetResult =
  | {
      type: "applied";
      changeSet: AgentChangeSetRecord;
      previousVersion: number;
      newVersion: number;
    }
  | { type: "version_conflict"; actualVersion: number | null }
  | { type: "invalid_state"; status: AgentChangeSetRecord["status"] }
  | { type: "history_diverged" }
  | { type: "change_set_not_found" };

export class AgentControlRepository {
  constructor(readonly db: DbConnection) {}

  async createChangeSet(data: AgentChangeSetInsert): Promise<AgentChangeSetRecord> {
    return this.db.transaction((transaction) => createAgentChangeSetsDao(transaction).create(data));
  }

  async appendDraftAction({
    changeSetId,
    expectedRevision,
    draftSnapshot,
    actionId,
    result,
    forwardAction,
    inverseActions,
  }: {
    changeSetId: string;
    expectedRevision: number;
    draftSnapshot: PipelineGraphSnapshot;
    actionId: string;
    result: Record<string, unknown>;
    forwardAction: NonNullable<AgentActionInsert["forwardAction"]>;
    inverseActions: NonNullable<AgentActionInsert["inverseActions"]>;
  }): Promise<AppendDraftActionResult> {
    return this.db.transaction(async (transaction) => {
      const actionsDao = createAgentActionsDao(transaction);
      const changeSetsDao = createAgentChangeSetsDao(transaction);
      const changeSet = await changeSetsDao.findById(changeSetId);
      if (!changeSet) return { type: "change_set_not_found" };
      const action = await actionsDao.findById(actionId);
      if (!action || action.changeSetId !== changeSetId) return { type: "change_set_not_found" };
      if (action.status === "succeeded" || action.status === "replayed") {
        return { type: "replayed", action, changeSet };
      }
      const updated = await changeSetsDao.updateDraftWithExpectedRevision(
        changeSetId,
        expectedRevision,
        draftSnapshot,
      );
      if (!updated) return { type: "revision_conflict" };
      const completed = await actionsDao.update(actionId, {
        status: "succeeded",
        result,
        forwardAction,
        inverseActions,
        completedAt: new Date(),
      });
      if (!completed) return { type: "change_set_not_found" };

      return { type: "applied", action: completed, changeSet: updated };
    });
  }

  async applyChangeSet(
    changeSetId: string,
    expectedVersion: number,
  ): Promise<ApplyChangeSetResult> {
    return this.db.transaction(async (transaction) => {
      const changeSetsDao = createAgentChangeSetsDao(transaction);
      const pipelinesDao = createPipelinesDao(transaction);
      const current = await changeSetsDao.findById(changeSetId);
      if (!current) return { type: "change_set_not_found" };
      if (current.status !== "ready") return { type: "invalid_state", status: current.status };
      if (!current.draftSnapshot || current.targetType !== "pipeline") {
        return { type: "invalid_state", status: current.status };
      }
      const applying = await changeSetsDao.transition(changeSetId, ["ready"], {
        status: "applying",
      });
      if (!applying) return { type: "invalid_state", status: current.status };
      const updatedPipeline = await pipelinesDao.replaceGraphWithExpectedVersion(
        current.targetId,
        expectedVersion,
        current.draftSnapshot,
      );
      if (!updatedPipeline) {
        const actual = await pipelinesDao.findById(current.targetId);
        await changeSetsDao.update(changeSetId, { status: "conflicted" });

        return { type: "version_conflict", actualVersion: actual?.version ?? null };
      }
      const committed = await changeSetsDao.transition(changeSetId, ["applying"], {
        status: "committed",
        appliedVersion: updatedPipeline.version,
        committedAt: new Date(),
      });
      if (!committed) throw new Error(`Change Set ${changeSetId} lost its applying state`);

      return {
        type: "applied",
        changeSet: committed,
        previousVersion: expectedVersion,
        newVersion: updatedPipeline.version,
      };
    });
  }

  async rejectChangeSet(changeSetId: string): Promise<AgentChangeSetRecord | null> {
    return this.db.transaction((transaction) =>
      createAgentChangeSetsDao(transaction).transition(
        changeSetId,
        ["drafting", "ready", "conflicted"],
        { status: "rejected" },
      ),
    );
  }

  async requestApproval({
    action,
    approval,
  }: {
    action: AgentActionInsert;
    approval: AgentApprovalInsert;
  }): Promise<{ action: AgentActionRecord; approval: AgentApprovalRecord; created: boolean }> {
    return this.db.transaction(async (transaction) => {
      const actionsDao = createAgentActionsDao(transaction);
      const approvalsDao = createAgentApprovalsDao(transaction);
      const persisted = await actionsDao.createIdempotent(action);
      if (!persisted.created) {
        const existingApproval = await approvalsDao.findByActionId(persisted.action.id);
        if (!existingApproval) {
          throw new Error(`Approval is missing for action ${persisted.action.id}`);
        }

        return { action: persisted.action, approval: existingApproval, created: false };
      }
      const createdApproval = await approvalsDao.create({
        ...approval,
        actionId: persisted.action.id,
      });

      return { action: persisted.action, approval: createdApproval, created: true };
    });
  }

  async consumeApproval({
    approvalId,
    actionId,
    callId,
    argumentDigest,
    now,
  }: {
    approvalId: string;
    actionId: string;
    callId: string;
    argumentDigest: string;
    now: Date;
  }): Promise<AgentApprovalRecord | null> {
    return this.db.transaction(async (transaction) => {
      const approvalsDao = createAgentApprovalsDao(transaction);
      const approval = await approvalsDao.findById(approvalId);
      if (
        !approval ||
        approval.actionId !== actionId ||
        approval.callId !== callId ||
        approval.argumentDigest !== argumentDigest
      ) {
        return null;
      }

      return approvalsDao.consume(approvalId, now);
    });
  }

  async compensateChangeSet({
    sourceChangeSetId,
    expectedVersion,
    kind,
    id,
    runId,
  }: {
    sourceChangeSetId: string;
    expectedVersion: number;
    kind: "revert" | "redo";
    id: string;
    runId?: string | null;
  }): Promise<CompensateChangeSetResult> {
    return this.db.transaction(async (transaction) => {
      const changeSetsDao = createAgentChangeSetsDao(transaction);
      const pipelinesDao = createPipelinesDao(transaction);
      const source = await changeSetsDao.findById(sourceChangeSetId);
      if (!source) return { type: "change_set_not_found" };
      const expectedStatus = kind === "revert" ? "committed" : "reverted";
      if (source.status !== expectedStatus) return { type: "invalid_state", status: source.status };
      if (!source.baseSnapshot || !source.draftSnapshot || source.targetType !== "pipeline") {
        return { type: "invalid_state", status: source.status };
      }
      if (kind === "revert" && source.appliedVersion !== expectedVersion) {
        return { type: "history_diverged" };
      }
      if (kind === "redo") {
        const latest = await changeSetsDao.findLatestByOriginChangeSetId(source.id);
        if (
          !latest ||
          latest.kind !== "revert" ||
          latest.status !== "committed" ||
          latest.appliedVersion !== expectedVersion
        ) {
          return { type: "history_diverged" };
        }
      }
      const pipeline = await pipelinesDao.findById(source.targetId);
      if (!pipeline || pipeline.version !== expectedVersion) {
        return { type: "version_conflict", actualVersion: pipeline?.version ?? null };
      }
      const before = {
        nodes: pipeline.nodes,
        edges: pipeline.edges,
      } satisfies PipelineGraphSnapshot;
      const after = kind === "revert" ? source.baseSnapshot : source.draftSnapshot;
      const updatedPipeline = await pipelinesDao.replaceGraphWithExpectedVersion(
        source.targetId,
        expectedVersion,
        after,
      );
      if (!updatedPipeline) {
        const actual = await pipelinesDao.findById(source.targetId);

        return { type: "version_conflict", actualVersion: actual?.version ?? null };
      }
      const compensating = await changeSetsDao.create({
        id,
        threadId: source.threadId,
        runId: runId ?? null,
        actor: source.actor,
        kind,
        originChangeSetId: source.id,
        targetType: source.targetType,
        targetId: source.targetId,
        baseVersion: expectedVersion,
        revision: 0,
        appliedVersion: updatedPipeline.version,
        status: "committed",
        baseSnapshot: before,
        draftSnapshot: after,
        committedAt: new Date(),
      });
      const nextSourceStatus = kind === "revert" ? "reverted" : "committed";
      const updatedSource = await changeSetsDao.transition(source.id, [source.status], {
        status: nextSourceStatus,
      });
      if (!updatedSource) throw new Error(`Change Set ${source.id} changed during ${kind}`);

      return {
        type: "applied",
        changeSet: compensating,
        previousVersion: expectedVersion,
        newVersion: updatedPipeline.version,
      };
    });
  }
}

export const createAgentControlRepository = (db: DbConnection) => new AgentControlRepository(db);
