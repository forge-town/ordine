import { eq, desc } from "drizzle-orm";
import { db } from "@repo/db";
import {
  operationsTable,
  type OperationRow,
  type NewOperationRow,
  type ObjectType,
} from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

export type OperationEntity = Omit<
  OperationRow,
  "createdAt" | "updatedAt" | "acceptedObjectTypes"
> & {
  createdAt: number;
  updatedAt: number;
  acceptedObjectTypes: ObjectType[];
};

const rowToEntity = (row: OperationRow): OperationEntity => ({
  ...row,
  acceptedObjectTypes: (row.acceptedObjectTypes as ObjectType[]) ?? ["file", "folder", "project"],
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

const entityToRow = (data: Omit<OperationEntity, "createdAt" | "updatedAt">): NewOperationRow => ({
  ...data,
});

export const operationsDao = {
  async findMany(): Promise<OperationEntity[]> {
    const rows = await db.select().from(operationsTable).orderBy(desc(operationsTable.createdAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<OperationEntity | null> {
    const rows = await db.select().from(operationsTable).where(eq(operationsTable.id, id)).limit(1);
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async create(data: Omit<OperationEntity, "createdAt" | "updatedAt">): Promise<OperationEntity> {
    const [inserted] = await db.insert(operationsTable).values(entityToRow(data)).returning();
    return rowToEntity(inserted!);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<OperationEntity, "createdAt" | "updatedAt">,
  ): Promise<OperationEntity> {
    const [inserted] = await tx.insert(operationsTable).values(entityToRow(data)).returning();
    return rowToEntity(inserted!);
  },

  async update(
    id: string,
    data: Partial<Omit<OperationEntity, "id" | "createdAt" | "updatedAt">>,
  ): Promise<OperationEntity | null> {
    const [updated] = await db
      .update(operationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(operationsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    data: Partial<Omit<OperationEntity, "id" | "createdAt" | "updatedAt">>,
  ): Promise<OperationEntity | null> {
    const [updated] = await tx
      .update(operationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(operationsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(operationsTable).where(eq(operationsTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(operationsTable).where(eq(operationsTable.id, id));
  },
};
