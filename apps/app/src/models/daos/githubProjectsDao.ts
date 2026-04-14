import { eq, desc } from "drizzle-orm";
import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";
import { db } from "@/db";
import {
  githubProjectsTable,
  type GithubProjectRow,
  type NewGithubProjectRow,
} from "@/models/tables/github_projects_table";

export type GithubProjectEntity = Omit<GithubProjectRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

type DbExecutor =
  | PostgresJsDatabase<Record<string, unknown>>
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;

const rowToEntity = (row: GithubProjectRow): GithubProjectEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const githubProjectsDao = {
  async findMany(): Promise<GithubProjectEntity[]> {
    const rows = await db
      .select()
      .from(githubProjectsTable)
      .orderBy(desc(githubProjectsTable.updatedAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<GithubProjectEntity | null> {
    const rows = await db
      .select()
      .from(githubProjectsTable)
      .where(eq(githubProjectsTable.id, id))
      .limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async create(
    data: Omit<GithubProjectEntity, "createdAt" | "updatedAt">
  ): Promise<GithubProjectEntity> {
    const now = new Date();
    const row: NewGithubProjectRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(githubProjectsTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<GithubProjectEntity, "createdAt" | "updatedAt">
  ): Promise<GithubProjectEntity> {
    const now = new Date();
    const row: NewGithubProjectRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await tx.insert(githubProjectsTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async update(
    id: string,
    patch: Partial<Omit<GithubProjectEntity, "id" | "createdAt" | "updatedAt">>
  ): Promise<GithubProjectEntity | null> {
    const [updated] = await db
      .update(githubProjectsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(githubProjectsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    patch: Partial<Omit<GithubProjectEntity, "id" | "createdAt" | "updatedAt">>
  ): Promise<GithubProjectEntity | null> {
    const [updated] = await tx
      .update(githubProjectsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(githubProjectsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(githubProjectsTable).where(eq(githubProjectsTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(githubProjectsTable).where(eq(githubProjectsTable.id, id));
  },
};
