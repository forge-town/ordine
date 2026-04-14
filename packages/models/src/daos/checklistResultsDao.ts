import { eq } from "drizzle-orm";
import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";
import { db } from "@repo/db";
import {
  checklistResultsTable,
  type ChecklistResultRow,
  type NewChecklistResultRow,
} from "@repo/db-schema";

export type ChecklistResultEntity = Omit<ChecklistResultRow, "createdAt"> & {
  createdAt: number;
};

type DbExecutor =
  | PostgresJsDatabase<Record<string, unknown>>
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;

const rowToEntity = (row: ChecklistResultRow): ChecklistResultEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
});

export const checklistResultsDao = {
  async findByJobId(jobId: string): Promise<ChecklistResultEntity[]> {
    const rows = await db
      .select()
      .from(checklistResultsTable)
      .where(eq(checklistResultsTable.jobId, jobId));
    return rows.map(rowToEntity);
  },

  async create(data: Omit<ChecklistResultEntity, "createdAt">): Promise<ChecklistResultEntity> {
    const now = new Date();
    const row: NewChecklistResultRow = { ...data, createdAt: now };
    const [inserted] = await db.insert(checklistResultsTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<ChecklistResultEntity, "createdAt">
  ): Promise<ChecklistResultEntity> {
    const now = new Date();
    const row: NewChecklistResultRow = { ...data, createdAt: now };
    const [inserted] = await tx.insert(checklistResultsTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async createManyWithTx(
    tx: DbExecutor,
    data: Omit<ChecklistResultEntity, "createdAt">[]
  ): Promise<ChecklistResultEntity[]> {
    const now = new Date();
    const rows: NewChecklistResultRow[] = data.map((d) => ({
      ...d,
      createdAt: now,
    }));
    const inserted = await tx.insert(checklistResultsTable).values(rows).returning();
    return inserted.map(rowToEntity);
  },

  async update(
    id: string,
    patch: Partial<Pick<ChecklistResultEntity, "passed" | "output">>
  ): Promise<ChecklistResultEntity | null> {
    const [updated] = await db
      .update(checklistResultsTable)
      .set(patch)
      .where(eq(checklistResultsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async deleteByJobId(jobId: string): Promise<void> {
    await db.delete(checklistResultsTable).where(eq(checklistResultsTable.jobId, jobId));
  },

  async deleteByJobIdWithTx(tx: DbExecutor, jobId: string): Promise<void> {
    await tx.delete(checklistResultsTable).where(eq(checklistResultsTable.jobId, jobId));
  },
};
