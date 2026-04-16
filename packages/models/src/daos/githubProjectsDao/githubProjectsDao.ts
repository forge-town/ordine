import { eq, desc } from "drizzle-orm";
import { githubProjectsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

class GithubProjectsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(githubProjectsTable)
      .orderBy(desc(githubProjectsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(githubProjectsTable)
      .where(eq(githubProjectsTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: typeof githubProjectsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(githubProjectsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();
    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof githubProjectsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(githubProjectsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(githubProjectsTable.id, id))
      .returning();
    return updated ?? null;
  }

  async delete(id: string) {
    await this.executor.delete(githubProjectsTable).where(eq(githubProjectsTable.id, id));
  }
}

export const createGithubProjectsDao = (executor: DbExecutor) => {
  return new GithubProjectsDao(executor);
};

export type GithubProjectsDaoInstance = ReturnType<typeof createGithubProjectsDao>;
