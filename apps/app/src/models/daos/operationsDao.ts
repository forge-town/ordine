import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  operationsTable,
  type OperationRow,
  type NewOperationRow,
  type ObjectType,
  type Visibility,
} from "@/models/tables/operations_table";

export type OperationEntity = Omit<
  OperationRow,
  "createdAt" | "updatedAt" | "acceptedObjectTypes" | "visibility"
> & {
  createdAt: number;
  updatedAt: number;
  acceptedObjectTypes: ObjectType[];
  visibility: Visibility;
};

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

const rowToEntity = (row: OperationRow): OperationEntity => ({
  ...row,
  visibility: (row.visibility as Visibility) ?? "public",
  acceptedObjectTypes: (row.acceptedObjectTypes as ObjectType[]) ?? [
    "file",
    "folder",
    "project",
  ],
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const operationsDao = {
  async findMany(): Promise<OperationEntity[]> {
    const rows = await db
      .select()
      .from(operationsTable)
      .orderBy(desc(operationsTable.createdAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<OperationEntity | null> {
    const rows = await db
      .select()
      .from(operationsTable)
      .where(eq(operationsTable.id, id));
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async create(data: NewOperationRow): Promise<OperationEntity> {
    const rows = await db.insert(operationsTable).values(data).returning();
    return rowToEntity(rows[0]);
  },

  async createWithTx(
    tx: DbExecutor,
    data: NewOperationRow,
  ): Promise<OperationEntity> {
    const rows = await tx.insert(operationsTable).values(data).returning();
    return rowToEntity(rows[0]);
  },

  async update(
    id: string,
    data: Partial<Omit<NewOperationRow, "id">>,
  ): Promise<OperationEntity> {
    const rows = await db
      .update(operationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(operationsTable.id, id))
      .returning();
    return rowToEntity(rows[0]);
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    data: Partial<Omit<NewOperationRow, "id">>,
  ): Promise<OperationEntity> {
    const rows = await tx
      .update(operationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(operationsTable.id, id))
      .returning();
    return rowToEntity(rows[0]);
  },

  async delete(id: string): Promise<void> {
    await db.delete(operationsTable).where(eq(operationsTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(operationsTable).where(eq(operationsTable.id, id));
  },
};
