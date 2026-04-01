import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import {
  jobsTable,
  type JobRow,
  type NewJobRow,
  type JobStatus,
} from "@/models/tables/jobs_table";

export type JobEntity = Omit<
  JobRow,
  "createdAt" | "updatedAt" | "startedAt" | "finishedAt"
> & {
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};

const rowToEntity = (row: JobRow): JobEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
  startedAt: row.startedAt?.getTime() ?? null,
  finishedAt: row.finishedAt?.getTime() ?? null,
});

export const jobsDao = {
  async findMany(filter?: {
    status?: JobStatus;
    workId?: string;
    projectId?: string;
  }): Promise<JobEntity[]> {
    const conditions = [];
    if (filter?.status) conditions.push(eq(jobsTable.status, filter.status));
    if (filter?.workId) conditions.push(eq(jobsTable.workId, filter.workId));
    if (filter?.projectId)
      conditions.push(eq(jobsTable.projectId, filter.projectId));

    const rows = await db
      .select()
      .from(jobsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobsTable.createdAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<JobEntity | null> {
    const rows = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, id))
      .limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async create(
    data: Omit<JobEntity, "createdAt" | "updatedAt">,
  ): Promise<JobEntity> {
    const now = new Date();
    const row: NewJobRow = {
      ...data,
      startedAt: data.startedAt != null ? new Date(data.startedAt) : null,
      finishedAt: data.finishedAt != null ? new Date(data.finishedAt) : null,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(jobsTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async updateStatus(
    id: string,
    status: JobStatus,
    extra?: {
      logs?: string[];
      error?: string;
      result?: JobEntity["result"];
      startedAt?: number;
      finishedAt?: number;
    },
  ): Promise<JobEntity | null> {
    const patch: Partial<JobRow> = {
      status,
      updatedAt: new Date(),
      ...(extra?.error !== undefined && { error: extra.error }),
      ...(extra?.result !== undefined && { result: extra.result }),
      ...(extra?.logs !== undefined && { logs: extra.logs }),
      ...(extra?.startedAt !== undefined && {
        startedAt: new Date(extra.startedAt),
      }),
      ...(extra?.finishedAt !== undefined && {
        finishedAt: new Date(extra.finishedAt),
      }),
    };
    const [updated] = await db
      .update(jobsTable)
      .set(patch)
      .where(eq(jobsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async appendLog(id: string, line: string): Promise<void> {
    // append by fetching then updating
    const job = await jobsDao.findById(id);
    if (!job) return;
    await db
      .update(jobsTable)
      .set({ logs: [...job.logs, line], updatedAt: new Date() })
      .where(eq(jobsTable.id, id));
  },

  async delete(id: string): Promise<void> {
    await db.delete(jobsTable).where(eq(jobsTable.id, id));
  },
};
