import { eq, asc } from "drizzle-orm";
import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";
import { db } from "@/db";
import {
  checklistItemsTable,
  type ChecklistItemRow,
  type NewChecklistItemRow,
} from "@/models/tables/checklist_items_table";

export type ChecklistItemEntity = Omit<ChecklistItemRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

type DbExecutor =
  | PostgresJsDatabase<Record<string, unknown>>
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;

const rowToEntity = (row: ChecklistItemRow): ChecklistItemEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const checklistItemsDao = {
  async findByBestPracticeId(bestPracticeId: string): Promise<ChecklistItemEntity[]> {
    const rows = await db
      .select()
      .from(checklistItemsTable)
      .where(eq(checklistItemsTable.bestPracticeId, bestPracticeId))
      .orderBy(asc(checklistItemsTable.sortOrder));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<ChecklistItemEntity | null> {
    const rows = await db
      .select()
      .from(checklistItemsTable)
      .where(eq(checklistItemsTable.id, id))
      .limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async create(
    data: Omit<ChecklistItemEntity, "createdAt" | "updatedAt">
  ): Promise<ChecklistItemEntity> {
    const now = new Date();
    const row: NewChecklistItemRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(checklistItemsTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<ChecklistItemEntity, "createdAt" | "updatedAt">
  ): Promise<ChecklistItemEntity> {
    const now = new Date();
    const row: NewChecklistItemRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await tx.insert(checklistItemsTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async update(
    id: string,
    patch: Partial<Omit<ChecklistItemEntity, "id" | "bestPracticeId" | "createdAt" | "updatedAt">>
  ): Promise<ChecklistItemEntity | null> {
    const [updated] = await db
      .update(checklistItemsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(checklistItemsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    patch: Partial<Omit<ChecklistItemEntity, "id" | "bestPracticeId" | "createdAt" | "updatedAt">>
  ): Promise<ChecklistItemEntity | null> {
    const [updated] = await tx
      .update(checklistItemsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(checklistItemsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(checklistItemsTable).where(eq(checklistItemsTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(checklistItemsTable).where(eq(checklistItemsTable.id, id));
  },

  async deleteByBestPracticeId(bestPracticeId: string): Promise<void> {
    await db
      .delete(checklistItemsTable)
      .where(eq(checklistItemsTable.bestPracticeId, bestPracticeId));
  },
};
