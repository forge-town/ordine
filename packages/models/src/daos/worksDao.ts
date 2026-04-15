import { eq, desc } from "drizzle-orm";
import { db } from "@repo/db";
import {
  worksTable,
  type WorkRow,
  type NewWorkRow,
  type WorkStatus,
  type WorkObject,
} from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

export type WorkEntity = Omit<WorkRow, "createdAt" | "updatedAt" | "startedAt" | "finishedAt"> & {
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};

const rowToEntity = (row: WorkRow): WorkEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
  startedAt: row.startedAt?.getTime() ?? null,
  finishedAt: row.finishedAt?.getTime() ?? null,
});

export const worksDao = {
  async findMany(): Promise<WorkEntity[]> {
    const rows = await db.select().from(worksTable).orderBy(desc(worksTable.createdAt));
    return rows.map(rowToEntity);
  },

  async findByProject(projectId: string): Promise<WorkEntity[]> {
    const rows = await db
      .select()
      .from(worksTable)
      .where(eq(worksTable.projectId, projectId))
      .orderBy(desc(worksTable.createdAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<WorkEntity | null> {
    const rows = await db.select().from(worksTable).where(eq(worksTable.id, id)).limit(1);
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async create(
    data: Omit<WorkEntity, "createdAt" | "updatedAt" | "startedAt" | "finishedAt">,
  ): Promise<WorkEntity> {
    const now = new Date();
    const row: NewWorkRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    const [inserted] = await db.insert(worksTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<WorkEntity, "createdAt" | "updatedAt" | "startedAt" | "finishedAt">,
  ): Promise<WorkEntity> {
    const now = new Date();
    const row: NewWorkRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    const [inserted] = await tx.insert(worksTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async updateStatus(
    id: string,
    status: WorkStatus,
    extra?: { logs?: string[]; startedAt?: Date; finishedAt?: Date },
  ): Promise<WorkEntity | null> {
    const [updated] = await db
      .update(worksTable)
      .set({ status, updatedAt: new Date(), ...extra })
      .where(eq(worksTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async updateStatusWithTx(
    tx: DbExecutor,
    id: string,
    status: WorkStatus,
    extra?: { logs?: string[]; startedAt?: Date; finishedAt?: Date },
  ): Promise<WorkEntity | null> {
    const [updated] = await tx
      .update(worksTable)
      .set({ status, updatedAt: new Date(), ...extra })
      .where(eq(worksTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async appendLog(id: string, line: string): Promise<void> {
    const work = await this.findById(id);
    if (!work) return;
    await db
      .update(worksTable)
      .set({ logs: [...work.logs, line], updatedAt: new Date() })
      .where(eq(worksTable.id, id));
  },

  async appendLogWithTx(tx: DbExecutor, id: string, line: string): Promise<void> {
    const rows = await tx.select().from(worksTable).where(eq(worksTable.id, id)).limit(1);
    const row = rows[0];
    if (!row) return;
    await tx
      .update(worksTable)
      .set({ logs: [...row.logs, line], updatedAt: new Date() })
      .where(eq(worksTable.id, id));
  },

  async delete(id: string): Promise<void> {
    await db.delete(worksTable).where(eq(worksTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(worksTable).where(eq(worksTable.id, id));
  },
};

export type { WorkObject };
