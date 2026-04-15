import { eq, asc } from "drizzle-orm";
import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";
import { db } from "@repo/db";
import { codeSnippetsTable, type CodeSnippetRow, type NewCodeSnippetRow } from "@repo/db-schema";

type DbExecutor =
  | PostgresJsDatabase<Record<string, unknown>>
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;

export type CodeSnippetEntity = Omit<CodeSnippetRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

const rowToEntity = (row: CodeSnippetRow): CodeSnippetEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const codeSnippetsDao = {
  async findByBestPracticeId(bestPracticeId: string): Promise<CodeSnippetEntity[]> {
    const rows = await db
      .select()
      .from(codeSnippetsTable)
      .where(eq(codeSnippetsTable.bestPracticeId, bestPracticeId))
      .orderBy(asc(codeSnippetsTable.sortOrder));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<CodeSnippetEntity | null> {
    const rows = await db
      .select()
      .from(codeSnippetsTable)
      .where(eq(codeSnippetsTable.id, id))
      .limit(1);
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async create(
    data: Omit<CodeSnippetEntity, "createdAt" | "updatedAt">,
  ): Promise<CodeSnippetEntity> {
    const now = new Date();
    const row: NewCodeSnippetRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(codeSnippetsTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<CodeSnippetEntity, "createdAt" | "updatedAt">,
  ): Promise<CodeSnippetEntity> {
    const now = new Date();
    const row: NewCodeSnippetRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await tx.insert(codeSnippetsTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async update(
    id: string,
    patch: Partial<Omit<CodeSnippetEntity, "id" | "bestPracticeId" | "createdAt" | "updatedAt">>,
  ): Promise<CodeSnippetEntity | null> {
    const [updated] = await db
      .update(codeSnippetsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(codeSnippetsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    patch: Partial<Omit<CodeSnippetEntity, "id" | "bestPracticeId" | "createdAt" | "updatedAt">>,
  ): Promise<CodeSnippetEntity | null> {
    const [updated] = await tx
      .update(codeSnippetsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(codeSnippetsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(codeSnippetsTable).where(eq(codeSnippetsTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(codeSnippetsTable).where(eq(codeSnippetsTable.id, id));
  },

  async deleteByBestPracticeId(bestPracticeId: string): Promise<void> {
    await db.delete(codeSnippetsTable).where(eq(codeSnippetsTable.bestPracticeId, bestPracticeId));
  },
};
