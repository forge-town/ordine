import { eq, desc } from "drizzle-orm";
import { recipesTable, type RecipeRow } from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

class RecipesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(recipesTable).orderBy(desc(recipesTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(recipesTable)
      .where(eq(recipesTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByOperationId(operationId: string) {
    return this.executor
      .select()
      .from(recipesTable)
      .where(eq(recipesTable.operationId, operationId))
      .orderBy(desc(recipesTable.updatedAt));
  }

  async create(data: typeof recipesTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(recipesTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();
    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof recipesTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(recipesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(recipesTable.id, id))
      .returning();
    return updated ?? null;
  }

  async delete(id: string) {
    await this.executor.delete(recipesTable).where(eq(recipesTable.id, id));
  }
}

export const createRecipesDao = (executor: DbExecutor) => {
  return new RecipesDao(executor);
};

export type RecipesDaoInstance = ReturnType<typeof createRecipesDao>;
