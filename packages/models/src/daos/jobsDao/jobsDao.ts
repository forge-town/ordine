import { and, desc, eq, inArray, isNotNull, isNull, lte, type SQL } from "drizzle-orm";
import { jobsTable, type JobRecord } from "@repo/db-schema";
import type {
  JobExpiryContext,
  JobExpiryReason,
  JobStatus,
  JobType,
  NodeRunStatus,
} from "@repo/schemas";
import type { DbExecutor } from "../../types";

const LIVE_JOB_STATUSES = ["running", "paused"] as const satisfies readonly JobStatus[];
const TERMINAL_JOB_STATUSES = new Set<JobStatus>([
  "done",
  "failed",
  "cancelled",
  "expired",
  "skipped",
]);

type JobStatusExtra = {
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
  totalTokens?: number;
};

export type ExpireStaleJobsOptions = {
  observedAt: Date;
  queuedTimeoutMs: number;
  legacyNoLeaseTimeoutMs: number;
  sweeperId: string;
};

const createStatusPatch = (
  status: JobStatus,
  now: Date,
  extra?: JobStatusExtra,
): Partial<JobRecord> => ({
  status,
  updatedAt: now,
  lastProgressAt: now,
  ...(TERMINAL_JOB_STATUSES.has(status) && {
    leaseOwnerId: null,
    leaseExpiresAt: null,
  }),
  ...(extra?.error !== undefined && { error: extra.error }),
  ...(extra?.startedAt !== undefined && { startedAt: extra.startedAt }),
  ...(extra?.finishedAt !== undefined && { finishedAt: extra.finishedAt }),
  ...(extra?.totalTokens !== undefined && { totalTokens: extra.totalTokens }),
});

export class JobsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany(filter?: { status?: JobStatus; type?: JobType; parentJobId?: string }) {
    const conditions = [];
    if (filter?.status) conditions.push(eq(jobsTable.status, filter.status));
    if (filter?.type) conditions.push(eq(jobsTable.type, filter.type));
    if (filter?.parentJobId) conditions.push(eq(jobsTable.parentJobId, filter.parentJobId));

    return this.executor
      .select()
      .from(jobsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobsTable.createdAt));
  }

  async findById(id: string) {
    const rows = await this.executor.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);

    return rows[0];
  }

  async create(data: typeof jobsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(jobsTable)
      .values({ ...data, lastProgressAt: now, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async updateStatus(id: string, status: JobStatus, extra?: JobStatusExtra) {
    const now = new Date();
    const [updated] = await this.executor
      .update(jobsTable)
      .set(createStatusPatch(status, now, extra))
      .where(eq(jobsTable.id, id))
      .returning();

    return updated;
  }

  async transitionStatus(
    id: string,
    from: readonly JobStatus[],
    status: JobStatus,
    extra?: JobStatusExtra,
  ) {
    const now = new Date();
    const [updated] = await this.executor
      .update(jobsTable)
      .set(createStatusPatch(status, now, extra))
      .where(and(eq(jobsTable.id, id), inArray(jobsTable.status, [...from])))
      .returning();

    return updated;
  }

  async setNodeStatuses(id: string, nodeStatuses: Record<string, NodeRunStatus>) {
    const now = new Date();
    const [updated] = await this.executor
      .update(jobsTable)
      .set({ nodeStatuses, lastProgressAt: now, updatedAt: now })
      .where(eq(jobsTable.id, id))
      .returning();

    return updated;
  }

  async claimExecutionLease(id: string, leaseOwnerId: string, now: Date, leaseExpiresAt: Date) {
    const [claimed] = await this.executor
      .update(jobsTable)
      .set({
        status: "running" as JobStatus,
        startedAt: now,
        lastProgressAt: now,
        heartbeatAt: now,
        leaseOwnerId,
        leaseExpiresAt,
        expiryContext: null,
        updatedAt: now,
      })
      .where(
        and(eq(jobsTable.id, id), eq(jobsTable.status, "queued"), isNull(jobsTable.leaseOwnerId)),
      )
      .returning();

    return claimed;
  }

  async renewExecutionLease(id: string, leaseOwnerId: string, now: Date, leaseExpiresAt: Date) {
    const [renewed] = await this.executor
      .update(jobsTable)
      .set({ heartbeatAt: now, leaseExpiresAt, updatedAt: now })
      .where(
        and(
          eq(jobsTable.id, id),
          eq(jobsTable.leaseOwnerId, leaseOwnerId),
          inArray(jobsTable.status, [...LIVE_JOB_STATUSES]),
        ),
      )
      .returning({ status: jobsTable.status });

    return renewed;
  }

  async recordErrorIfExpired(id: string, error: string) {
    const [updated] = await this.executor
      .update(jobsTable)
      .set({ error, updatedAt: new Date() })
      .where(and(eq(jobsTable.id, id), eq(jobsTable.status, "expired"), isNull(jobsTable.error)))
      .returning();

    return updated;
  }

  async updateUsageTotals(id: string, totalTokens: number) {
    const [updated] = await this.executor
      .update(jobsTable)
      .set({ totalTokens, updatedAt: new Date() })
      .where(eq(jobsTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(jobsTable).where(eq(jobsTable.id, id));
  }

  async expireStaleJobs({
    observedAt,
    queuedTimeoutMs,
    legacyNoLeaseTimeoutMs,
    sweeperId,
  }: ExpireStaleJobsOptions) {
    const queuedStaleBefore = new Date(observedAt.getTime() - queuedTimeoutMs);
    const legacyStaleBefore = new Date(observedAt.getTime() - legacyNoLeaseTimeoutMs);

    const expire = async ({
      previousStatus,
      reason,
      staleBefore,
      timeoutMs,
      staleCondition,
    }: {
      previousStatus: "queued" | "running" | "paused";
      reason: JobExpiryReason;
      staleBefore: Date;
      timeoutMs: number | null;
      staleCondition: SQL | undefined;
    }) => {
      const expiryContext: JobExpiryContext = {
        reason,
        previousStatus,
        observedAtMs: observedAt.getTime(),
        staleBeforeMs: staleBefore.getTime(),
        timeoutMs,
        sweeperId,
      };
      const rows = await this.executor
        .update(jobsTable)
        .set({
          status: "expired" as JobStatus,
          finishedAt: observedAt,
          updatedAt: observedAt,
          expiryContext,
        })
        .where(and(eq(jobsTable.status, previousStatus), staleCondition))
        .returning({ id: jobsTable.id, expiryContext: jobsTable.expiryContext });

      return rows;
    };

    const expired = [];
    expired.push(
      ...(await expire({
        previousStatus: "queued",
        reason: "queue_timeout",
        staleBefore: queuedStaleBefore,
        timeoutMs: queuedTimeoutMs,
        staleCondition: and(
          isNull(jobsTable.leaseOwnerId),
          lte(jobsTable.createdAt, queuedStaleBefore),
        ),
      })),
    );

    for (const previousStatus of LIVE_JOB_STATUSES) {
      expired.push(
        ...(await expire({
          previousStatus,
          reason: "lease_expired",
          staleBefore: observedAt,
          timeoutMs: null,
          staleCondition: and(
            isNotNull(jobsTable.leaseExpiresAt),
            lte(jobsTable.leaseExpiresAt, observedAt),
          ),
        })),
      );
      expired.push(
        ...(await expire({
          previousStatus,
          reason: "legacy_no_lease_timeout",
          staleBefore: legacyStaleBefore,
          timeoutMs: legacyNoLeaseTimeoutMs,
          staleCondition: and(
            isNull(jobsTable.leaseExpiresAt),
            lte(jobsTable.lastProgressAt, legacyStaleBefore),
          ),
        })),
      );
    }

    return expired;
  }
}

export const createJobsDao = (executor: DbExecutor) => {
  return new JobsDao(executor);
};
