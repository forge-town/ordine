import { eq, desc } from "drizzle-orm";
import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";
import { db } from "@repo/db";
import { recipesTable, type RecipeRow, type NewRecipeRow } from "@repo/db-schema";

export type RecipeEntity = Omit<RecipeRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

type DbExecutor =
  | PostgresJsDatabase<Record<string, unknown>>
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;

const rowToEntity = (row: RecipeRow): RecipeEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const recipesDao = {
  async findMany(): Promise<RecipeEntity[]> {
    const rows = await db.select().from(recipesTable).orderBy(desc(recipesTable.updatedAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<RecipeEntity | null> {
    const rows = await db.select().from(recipesTable).where(eq(recipesTable.id, id)).limit(1);
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async findByOperationId(operationId: string): Promise<RecipeEntity[]> {
    const rows = await db
      .select()
      .from(recipesTable)
      .where(eq(recipesTable.operationId, operationId))
      .orderBy(desc(recipesTable.updatedAt));
    return rows.map(rowToEntity);
  },

  async create(data: Omit<RecipeEntity, "createdAt" | "updatedAt">): Promise<RecipeEntity> {
    const now = new Date();
    const row: NewRecipeRow = { ...data, createdAt: now, updatedAt: now };
    const [inserted] = await db.insert(recipesTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<RecipeEntity, "createdAt" | "updatedAt">
  ): Promise<RecipeEntity> {
    const now = new Date();
    const row: NewRecipeRow = { ...data, createdAt: now, updatedAt: now };
    const [inserted] = await tx.insert(recipesTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async update(
    id: string,
    patch: Partial<Omit<RecipeEntity, "id" | "createdAt" | "updatedAt">>
  ): Promise<RecipeEntity | null> {
    const [updated] = await db
      .update(recipesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(recipesTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    patch: Partial<Omit<RecipeEntity, "id" | "createdAt" | "updatedAt">>
  ): Promise<RecipeEntity | null> {
    const [updated] = await tx
      .update(recipesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(recipesTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(recipesTable).where(eq(recipesTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(recipesTable).where(eq(recipesTable.id, id));
  },
};
