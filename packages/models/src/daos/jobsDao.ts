import { eq, desc, and } from "drizzle-orm";
import { jobsTable, type JobRecord, type JobStatus } from "@repo/db-schema";
import type { DbExecutor } from "../types";

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
    return rows[0] ?? null;
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
      ...(extra?.startedAt !== undefined && { startedAt: extra.startedAt }),
      ...(extra?.finishedAt !== undefined && { finishedAt: extra.finishedAt }),
    };
    const [updated] = await this.executor
      .update(jobsTable)
      .set(patch)
      .where(eq(jobsTable.id, id))
      .returning();
    return updated ?? null;
  }

  async appendLog(id: string, line: string) {
    const job = await this.findById(id);
    if (!job) return;
    await this.executor
      .update(jobsTable)
      .set({ logs: [...job.logs, line], updatedAt: new Date() })
      .where(eq(jobsTable.id, id));
  }

  async delete(id: string) {
    await this.executor.delete(jobsTable).where(eq(jobsTable.id, id));
  }
}

export const createJobsDao = (executor: DbExecutor) => {
  return new JobsDao(executor);
};

export type JobsDaoInstance = ReturnType<typeof createJobsDao>;
