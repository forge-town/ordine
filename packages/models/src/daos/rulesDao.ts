import { eq, desc, and } from "drizzle-orm";
import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";
import { db } from "@repo/db";
import {
  rulesTable,
  type RuleRow,
  type NewRuleRow,
  type RuleCategory,
  type RuleSeverity,
} from "@repo/db-schema";

export type RuleEntity = Omit<RuleRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

type DbExecutor =
  | PostgresJsDatabase<Record<string, unknown>>
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;

const rowToEntity = (row: RuleRow): RuleEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const rulesDao = {
  async findMany(filter?: { category?: RuleCategory; enabled?: boolean }): Promise<RuleEntity[]> {
    const conditions = [];
    if (filter?.category) conditions.push(eq(rulesTable.category, filter.category));
    if (filter?.enabled !== undefined) conditions.push(eq(rulesTable.enabled, filter.enabled));

    const rows = await db
      .select()
      .from(rulesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rulesTable.createdAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<RuleEntity | null> {
    const rows = await db.select().from(rulesTable).where(eq(rulesTable.id, id)).limit(1);
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async create(data: Omit<RuleEntity, "createdAt" | "updatedAt">): Promise<RuleEntity> {
    const now = new Date();
    const row: NewRuleRow = { ...data, createdAt: now, updatedAt: now };
    const [inserted] = await db.insert(rulesTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<RuleEntity, "createdAt" | "updatedAt">
  ): Promise<RuleEntity> {
    const now = new Date();
    const row: NewRuleRow = { ...data, createdAt: now, updatedAt: now };
    const [inserted] = await tx.insert(rulesTable).values(row).returning();
    return rowToEntity(inserted!);
  },

  async update(
    id: string,
    data: Partial<Omit<RuleEntity, "id" | "createdAt" | "updatedAt">>
  ): Promise<RuleEntity | null> {
    const rows = await db
      .update(rulesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    data: Partial<Omit<RuleEntity, "id" | "createdAt" | "updatedAt">>
  ): Promise<RuleEntity | null> {
    const rows = await tx
      .update(rulesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async toggleEnabled(id: string, enabled: boolean): Promise<RuleEntity | null> {
    const rows = await db
      .update(rulesTable)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async toggleEnabledWithTx(
    tx: DbExecutor,
    id: string,
    enabled: boolean
  ): Promise<RuleEntity | null> {
    const rows = await tx
      .update(rulesTable)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();
    return rows[0] ? rowToEntity(rows[0]!) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(rulesTable).where(eq(rulesTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(rulesTable).where(eq(rulesTable.id, id));
  },
};

export type { RuleCategory, RuleSeverity };
