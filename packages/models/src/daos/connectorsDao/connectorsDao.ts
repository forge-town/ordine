import { and, desc, eq } from "drizzle-orm";
import { connectorsTable } from "@repo/db-schema";
import type { ConnectorConfig, ConnectorMethod } from "@repo/schemas";
import type { DbExecutor } from "../../types";

export class ConnectorsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(connectorsTable).orderBy(desc(connectorsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(connectorsTable)
      .where(eq(connectorsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof connectorsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(connectorsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof connectorsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(connectorsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(connectorsTable.id, id))
      .returning();

    return updated;
  }

  /**
   * Compare-and-set update: only writes if the row still matches the expected
   * method and config snapshot. Returns undefined when the predicate fails,
   * allowing callers to turn the missed write into a concurrency conflict.
   */
  async updateIfConfigUnchanged(
    id: string,
    patch: Partial<Omit<typeof connectorsTable.$inferInsert, "id">>,
    expectedMethod: ConnectorMethod,
    expectedConfig: ConnectorConfig,
  ) {
    const [updated] = await this.executor
      .update(connectorsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(connectorsTable.id, id),
          eq(connectorsTable.method, expectedMethod),
          eq(connectorsTable.config, expectedConfig),
        ),
      )
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(connectorsTable).where(eq(connectorsTable.id, id));
  }
}

export const createConnectorsDao = (executor: DbExecutor) => new ConnectorsDao(executor);
