import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { executionJobsTable as table, type ExecutionJobRecord } from "@repo/db-schema";
import type { ExecutionJobState } from "@repo/schemas";
import type { DbExecutor } from "../../types";
import type { ExecutionIdentity, ExecutionLease } from "../../executionTypes";

type JobPatch = Partial<
  Omit<
    typeof table.$inferInsert,
    "id" | "workspaceId" | "subjectId" | "runRequestId" | "preparedRunId" | "createdAt"
  >
>;
const ACTIVE = [
  "running",
  "pausing",
  "paused",
  "waiting_for_input",
  "cancelling",
] satisfies ExecutionJobState[];
const identityFilter = (identity: ExecutionIdentity, id: string) =>
  and(
    eq(table.id, id),
    eq(table.workspaceId, identity.workspaceId),
    eq(table.subjectId, identity.subjectId),
  );

export const createExecutionJobsDao = (executor: DbExecutor) => ({
  async findById(identity: ExecutionIdentity, id: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.workspaceId, identity.workspaceId),
          eq(table.subjectId, identity.subjectId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  },
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },

  async lockById(identity: ExecutionIdentity, id: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(identityFilter(identity, id))
      .limit(1)
      .for("update");

    return rows[0] ?? null;
  },
  async lockNext(workspaceId: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.workspaceId, workspaceId),
          eq(table.state, "queued"),
          isNull(table.executorId),
          isNull(table.startedAt),
        ),
      )
      .orderBy(asc(table.createdAt), asc(table.id))
      .limit(1)
      .for("update", { skipLocked: true });

    return rows[0] ?? null;
  },
  async lockExpired(workspaceId: string) {
    return executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.workspaceId, workspaceId),
          inArray(table.state, ACTIVE),
          or(isNull(table.leaseExpiresAt), lte(table.leaseExpiresAt, sql`clock_timestamp()`)),
        ),
      )
      .orderBy(asc(table.id))
      .limit(200)
      .for("update", { skipLocked: true });
  },
  async list(identity: ExecutionIdentity) {
    return executor
      .select()
      .from(table)
      .where(
        and(eq(table.workspaceId, identity.workspaceId), eq(table.subjectId, identity.subjectId)),
      )
      .orderBy(desc(table.createdAt), desc(table.id));
  },
  async claim(job: ExecutionJobRecord, executorId: string, leaseMs: number, now: Date) {
    const rows = await executor
      .update(table)
      .set({
        state: "running",
        executorId,
        generation: sql`${table.generation} + 1`,
        revision: sql`${table.revision} + 1`,
        startedAt: now,
        heartbeatAt: now,
        leaseExpiresAt: sql`clock_timestamp() + ${leaseMs} * interval '1 millisecond'`,
        deadlineAt: sql`clock_timestamp() + ${job.activeRemainingMs} * interval '1 millisecond'`,
        waitingDeadlineAt: null,
      })
      .where(
        and(
          identityFilter(job, job.id),
          eq(table.state, "queued"),
          isNull(table.executorId),
          isNull(table.startedAt),
        ),
      )
      .returning();

    return rows[0] ?? null;
  },
  async assertOwned(lease: ExecutionLease, requireBudget = false) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(
          identityFilter(lease, lease.jobId),
          eq(table.executorId, lease.executorId),
          eq(table.generation, lease.generation),
          inArray(table.state, ACTIVE),
          sql`${table.leaseExpiresAt} > clock_timestamp()`,
          requireBudget
            ? sql`(${table.deadlineAt} IS NULL OR ${table.deadlineAt} > clock_timestamp()) AND (${table.waitingDeadlineAt} IS NULL OR ${table.waitingDeadlineAt} > clock_timestamp())`
            : undefined,
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  },
  async updateOwned(
    lease: ExecutionLease,
    allowed: ExecutionJobState[],
    patch: JobPatch,
    bumpRevision = true,
    requireBudget = false,
  ) {
    const rows = await executor
      .update(table)
      .set({
        ...patch,
        revision: bumpRevision ? sql`${table.revision} + 1` : sql`${table.revision}`,
      })
      .where(
        and(
          identityFilter(lease, lease.jobId),
          eq(table.executorId, lease.executorId),
          eq(table.generation, lease.generation),
          inArray(table.state, allowed),
          sql`${table.leaseExpiresAt} > clock_timestamp()`,
          requireBudget
            ? sql`(${table.deadlineAt} IS NULL OR ${table.deadlineAt} > clock_timestamp()) AND (${table.waitingDeadlineAt} IS NULL OR ${table.waitingDeadlineAt} > clock_timestamp())`
            : undefined,
        ),
      )
      .returning();

    return rows[0] ?? null;
  },
  async refresh(lease: ExecutionLease, leaseMs: number, timedOut: boolean, now: Date) {
    const rows = await executor
      .update(table)
      .set({
        heartbeatAt: now,
        leaseExpiresAt: sql`clock_timestamp() + ${leaseMs} * interval '1 millisecond'`,
        ...(timedOut
          ? {
              state: "cancelling" as const,
              stopReason: "timed_out" as const,
              revision: sql`${table.revision} + 1`,
            }
          : {}),
      })
      .where(
        and(
          identityFilter(lease, lease.jobId),
          eq(table.executorId, lease.executorId),
          eq(table.generation, lease.generation),
          inArray(table.state, ACTIVE),
          sql`${table.leaseExpiresAt} > clock_timestamp()`,
        ),
      )
      .returning();

    return rows[0] ?? null;
  },
  async updateLocked(job: ExecutionJobRecord, patch: JobPatch) {
    const rows = await executor
      .update(table)
      .set({ ...patch, revision: sql`${table.revision} + 1` })
      .where(
        and(
          identityFilter(job, job.id),
          eq(table.revision, job.revision),
          eq(table.state, job.state),
          eq(table.generation, job.generation),
        ),
      )
      .returning();

    return rows[0] ?? null;
  },
});
