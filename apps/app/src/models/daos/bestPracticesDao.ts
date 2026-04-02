import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  bestPracticesTable,
  type BestPracticeRow,
  type NewBestPracticeRow,
} from "@/models/tables/best_practices_table";

export type BestPracticeEntity = Omit<
  BestPracticeRow,
  "createdAt" | "updatedAt"
> & {
  createdAt: number;
  updatedAt: number;
};

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

const rowToEntity = (row: BestPracticeRow): BestPracticeEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const bestPracticesDao = {
  async findMany(): Promise<BestPracticeEntity[]> {
    const rows = await db
      .select()
      .from(bestPracticesTable)
      .orderBy(desc(bestPracticesTable.updatedAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<BestPracticeEntity | null> {
    const rows = await db
      .select()
      .from(bestPracticesTable)
      .where(eq(bestPracticesTable.id, id))
      .limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async create(
    data: Omit<BestPracticeEntity, "createdAt" | "updatedAt">,
  ): Promise<BestPracticeEntity> {
    const now = new Date();
    const row: NewBestPracticeRow = { ...data, createdAt: now, updatedAt: now };
    const [inserted] = await db
      .insert(bestPracticesTable)
      .values(row)
      .returning();
    return rowToEntity(inserted);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<BestPracticeEntity, "createdAt" | "updatedAt">,
  ): Promise<BestPracticeEntity> {
    const now = new Date();
    const row: NewBestPracticeRow = { ...data, createdAt: now, updatedAt: now };
    const [inserted] = await tx
      .insert(bestPracticesTable)
      .values(row)
      .returning();
    return rowToEntity(inserted);
  },

  async update(
    id: string,
    patch: Partial<Omit<BestPracticeEntity, "id" | "createdAt" | "updatedAt">>,
  ): Promise<BestPracticeEntity | null> {
    const [updated] = await db
      .update(bestPracticesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(bestPracticesTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    patch: Partial<Omit<BestPracticeEntity, "id" | "createdAt" | "updatedAt">>,
  ): Promise<BestPracticeEntity | null> {
    const [updated] = await tx
      .update(bestPracticesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(bestPracticesTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(bestPracticesTable).where(eq(bestPracticesTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(bestPracticesTable).where(eq(bestPracticesTable.id, id));
  },
};
