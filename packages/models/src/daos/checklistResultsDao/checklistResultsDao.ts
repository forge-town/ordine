import { eq } from "drizzle-orm";
import { checklistResultsTable, type ChecklistResultRecord } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

class ChecklistResultsDao {
  constructor(readonly executor: DbExecutor) {}

  async findByJobId(jobId: string) {
    return this.executor
      .select()
      .from(checklistResultsTable)
      .where(eq(checklistResultsTable.jobId, jobId));
  }

  async create(data: typeof checklistResultsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(checklistResultsTable)
      .values({ ...data, createdAt: now })
      .returning();

    return inserted!;
  }

  async createMany(data: (typeof checklistResultsTable.$inferInsert)[]) {
    const now = new Date();
    const rows = data.map((d) => ({ ...d, createdAt: now }));

    return this.executor.insert(checklistResultsTable).values(rows).returning();
  }

  async update(id: string, patch: Partial<Pick<ChecklistResultRecord, "passed" | "output">>) {
    const [updated] = await this.executor
      .update(checklistResultsTable)
      .set(patch)
      .where(eq(checklistResultsTable.id, id))
      .returning();

    return updated;
  }

  async deleteByJobId(jobId: string) {
    await this.executor.delete(checklistResultsTable).where(eq(checklistResultsTable.jobId, jobId));
  }
}

export const createChecklistResultsDao = (executor: DbExecutor) => {
  return new ChecklistResultsDao(executor);
};

export type ChecklistResultsDaoInstance = ReturnType<typeof createChecklistResultsDao>;
