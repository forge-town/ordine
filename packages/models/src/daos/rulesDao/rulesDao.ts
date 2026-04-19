import { eq, desc, and } from "drizzle-orm";
import { rulesTable, type RuleCategory, type RuleSeverity } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

class RulesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany(filter?: { category?: RuleCategory; enabled?: boolean }) {
    const conditions = [];
    if (filter?.category) conditions.push(eq(rulesTable.category, filter.category));
    if (filter?.enabled !== undefined) conditions.push(eq(rulesTable.enabled, filter.enabled));

    return this.executor
      .select()
      .from(rulesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rulesTable.createdAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(rulesTable)
      .where(eq(rulesTable.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async create(data: typeof rulesTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(rulesTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, data: Partial<Omit<typeof rulesTable.$inferInsert, "id">>) {
    const rows = await this.executor
      .update(rulesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();

    return rows[0] ?? null;
  }

  async toggleEnabled(id: string, enabled: boolean) {
    const rows = await this.executor
      .update(rulesTable)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(rulesTable.id, id))
      .returning();

    return rows[0] ?? null;
  }

  async delete(id: string) {
    await this.executor.delete(rulesTable).where(eq(rulesTable.id, id));
  }
}

export const createRulesDao = (executor: DbExecutor) => {
  return new RulesDao(executor);
};

export type RulesDaoInstance = ReturnType<typeof createRulesDao>;

export type { RuleCategory, RuleSeverity };
