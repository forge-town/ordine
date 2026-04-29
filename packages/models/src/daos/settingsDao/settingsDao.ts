import { eq } from "drizzle-orm";
import { settingsTable, type SettingsRecord } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

const DEFAULT_ID = "default";

export class SettingsDao {
  constructor(readonly executor: DbExecutor) {}

  async get() {
    const rows = await this.executor
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, DEFAULT_ID))
      .limit(1);

    if (rows.length > 0) return rows[0]!;

    const [created] = await this.executor
      .insert(settingsTable)
      .values({ id: DEFAULT_ID })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const existingRows = await this.executor
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, DEFAULT_ID))
      .limit(1);

    return existingRows[0]!;
  }

  async update(
    patch: Partial<
      Pick<
        SettingsRecord,
        "defaultAgentRuntime" | "defaultApiKey" | "defaultModel" | "defaultOutputPath"
      >
    >,
  ) {
    await this.get();

    const [updated] = await this.executor
      .update(settingsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(settingsTable.id, DEFAULT_ID))
      .returning();

    return updated!;
  }
}

export const createSettingsDao = (executor: DbExecutor) => {
  return new SettingsDao(executor);
};
