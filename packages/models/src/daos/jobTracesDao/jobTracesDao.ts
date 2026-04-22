import { eq, desc } from "drizzle-orm";
import { jobTracesTable, type LogLevel } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class JobTracesDao {
  constructor(readonly executor: DbExecutor) {}

  async append(jobId: string, message: string, level: LogLevel = "info") {
    const [inserted] = await this.executor
      .insert(jobTracesTable)
      .values({ jobId, message, level })
      .returning();

    return inserted!;
  }

  async findByJobId(jobId: string) {
    return this.executor
      .select()
      .from(jobTracesTable)
      .where(eq(jobTracesTable.jobId, jobId))
      .orderBy(desc(jobTracesTable.createdAt));
  }

  async deleteByJobId(jobId: string) {
    await this.executor.delete(jobTracesTable).where(eq(jobTracesTable.jobId, jobId));
  }
}

export const createJobTracesDao = (executor: DbExecutor) => {
  return new JobTracesDao(executor);
};
