import { eq, desc, and, lt, isNull, or, sql } from "drizzle-orm";
import { jobsTable, type JobRecord, type JobStatus } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

class JobsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany(filter?: { status?: JobStatus; projectId?: string }) {
    const conditions = [];
    if (filter?.status) conditions.push(eq(jobsTable.status, filter.status));
    if (filter?.projectId) conditions.push(eq(jobsTable.projectId, filter.projectId));

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
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    extra?: {
      logs?: string[];
      error?: string;
      result?: JobRecord["result"];
      tmuxSessionName?: string;
      startedAt?: Date;
      finishedAt?: Date;
    },
  ) {
    const patch: Partial<JobRecord> = {
      status,
      updatedAt: new Date(),
      ...(extra?.error !== undefined && { error: extra.error }),
      ...(extra?.result !== undefined && { result: extra.result }),
      ...(extra?.logs !== undefined && { logs: extra.logs }),
      ...(extra?.tmuxSessionName !== undefined && { tmuxSessionName: extra.tmuxSessionName }),
      ...(extra?.startedAt !== undefined && { startedAt: extra.startedAt }),
      ...(extra?.finishedAt !== undefined && { finishedAt: extra.finishedAt }),
    };
    const [updated] = await this.executor
      .update(jobsTable)
      .set(patch)
      .where(eq(jobsTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(jobsTable).where(eq(jobsTable.id, id));
  }

  async expireStaleJobs(defaultTimeoutMs: number) {
    const now = new Date();
    const rows = await this.executor
      .update(jobsTable)
      .set({
        status: "expired" as JobStatus,
        error: "Job timed out: exceeded maximum runtime",
        finishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(jobsTable.status, "running"),
          or(
            sql`EXTRACT(EPOCH FROM (NOW() - ${jobsTable.startedAt})) * 1000 > ${defaultTimeoutMs}`,
            and(
              isNull(jobsTable.startedAt),
              lt(jobsTable.createdAt, new Date(now.getTime() - defaultTimeoutMs)),
            ),
          ),
        ),
      )
      .returning({ id: jobsTable.id });

    return rows;
  }
}

export const createJobsDao = (executor: DbExecutor) => {
  return new JobsDao(executor);
};

export type JobsDaoInstance = ReturnType<typeof createJobsDao>;
