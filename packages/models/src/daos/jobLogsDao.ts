import { eq, desc } from "drizzle-orm";
import { jobLogsTable, type LogLevel } from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

class JobLogsDao {
  constructor(readonly executor: DbExecutor) {}

  async append(jobId: string, message: string, level: LogLevel = "info") {
    const [inserted] = await this.executor
      .insert(jobLogsTable)
      .values({ jobId, message, level })
      .returning();
    return inserted!;
  }

  async findByJobId(jobId: string) {
    return this.executor
      .select()
      .from(jobLogsTable)
      .where(eq(jobLogsTable.jobId, jobId))
      .orderBy(desc(jobLogsTable.createdAt));
  }

  async deleteByJobId(jobId: string) {
    await this.executor.delete(jobLogsTable).where(eq(jobLogsTable.jobId, jobId));
  }
}

export const createJobLogsDao = (executor: DbExecutor) => {
  return new JobLogsDao(executor);
};

export type JobLogsDaoInstance = ReturnType<typeof createJobLogsDao>;
