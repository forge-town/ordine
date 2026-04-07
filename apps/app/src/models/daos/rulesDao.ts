import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  rulesTable,
  type RuleRow,
  type NewRuleRow,
  type RuleCategory,
  type RuleSeverity,
} from "@/models/tables/rules_table";

export type RuleEntity = Omit<RuleRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

const rowToEntity = (row: RuleRow): RuleEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const rulesDao = {
  async findMany(filter?: { category?: RuleCategory; enabled?: boolean }): Promise<RuleEntity[]> {
    const rows = await db.select().from(rulesTable).orderBy(desc(rulesTable.createdAt));
    return rows
      .filter((r) => {
        if (filter?.category && r.category !== filter.category) return false;
        if (filter?.enabled !== undefined && r.enabled !== filter.enabled) return false;
        return true;
      })
      .map(rowToEntity);
  },

  async findById(id: string): Promise<RuleEntity | null> {
    const rows = await db.select().from(rulesTable).where(eq(rulesTable.id, id)).limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async create(data: Omit<RuleEntity, "createdAt" | "updatedAt">): Promise<RuleEntity> {
    const now = new Date();
    const row: NewRuleRow = { ...data, createdAt: now, updatedAt: now };
    const inserted = await db.insert(rulesTable).values(row).returning();
    return rowToEntity(inserted[0]!);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<RuleEntity, "createdAt" | "updatedAt">
  ): Promise<RuleEntity> {
    const now = new Date();
    const row: NewRuleRow = { ...data, createdAt: now, updatedAt: now };
    const inserted = await tx.insert(rulesTable).values(row).returning();
    return rowToEntity(inserted[0]!);
  },

  async update(
    id: string,
    data: Partial<Omit<RuleEntity, "id" | "createdAt" | "updatedAt">>
  ): Promise<RuleEntity> {
    const rows = await db
      .update(rulesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();
    return rowToEntity(rows[0]!);
  },

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    data: Partial<Omit<RuleEntity, "id" | "createdAt" | "updatedAt">>
  ): Promise<RuleEntity> {
    const rows = await tx
      .update(rulesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();
    return rowToEntity(rows[0]!);
  },

  async toggleEnabled(id: string, enabled: boolean): Promise<RuleEntity> {
    const rows = await db
      .update(rulesTable)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();
    return rowToEntity(rows[0]!);
  },

  async toggleEnabledWithTx(tx: DbExecutor, id: string, enabled: boolean): Promise<RuleEntity> {
    const rows = await tx
      .update(rulesTable)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();
    return rowToEntity(rows[0]!);
  },

  async delete(id: string): Promise<void> {
    await db.delete(rulesTable).where(eq(rulesTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(rulesTable).where(eq(rulesTable.id, id));
  },
};

export type { RuleCategory, RuleSeverity };
