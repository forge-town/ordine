import { desc, eq } from "drizzle-orm";
import { projectsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class ProjectsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof projectsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(projectsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof projectsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(projectsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(projectsTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(projectsTable).where(eq(projectsTable.id, id));
  }
}

export const createProjectsDao = (executor: DbExecutor) => new ProjectsDao(executor);
