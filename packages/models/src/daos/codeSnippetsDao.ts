import { eq, asc } from "drizzle-orm";
import { codeSnippetsTable, type CodeSnippetRow } from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

class CodeSnippetsDao {
  constructor(readonly executor: DbExecutor) {}

  async findByBestPracticeId(bestPracticeId: string) {
    return this.executor
      .select()
      .from(codeSnippetsTable)
      .where(eq(codeSnippetsTable.bestPracticeId, bestPracticeId))
      .orderBy(asc(codeSnippetsTable.sortOrder));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(codeSnippetsTable)
      .where(eq(codeSnippetsTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: typeof codeSnippetsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(codeSnippetsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();
    return inserted!;
  }

  async update(
    id: string,
    patch: Partial<Omit<typeof codeSnippetsTable.$inferInsert, "id" | "bestPracticeId">>,
  ) {
    const [updated] = await this.executor
      .update(codeSnippetsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(codeSnippetsTable.id, id))
      .returning();
    return updated ?? null;
  }

  async delete(id: string) {
    await this.executor.delete(codeSnippetsTable).where(eq(codeSnippetsTable.id, id));
  }

  async deleteByBestPracticeId(bestPracticeId: string) {
    await this.executor
      .delete(codeSnippetsTable)
      .where(eq(codeSnippetsTable.bestPracticeId, bestPracticeId));
  }
}

export const createCodeSnippetsDao = (executor: DbExecutor) => {
  return new CodeSnippetsDao(executor);
};

export type CodeSnippetsDaoInstance = ReturnType<typeof createCodeSnippetsDao>;
