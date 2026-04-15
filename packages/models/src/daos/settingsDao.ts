import { eq } from "drizzle-orm";
import { settingsTable, type SettingsRow } from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

export type SettingsEntity = SettingsRow;

const DEFAULT_ID = "default";

class SettingsDao {
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
      .returning();
    return created!;
  }

  async update(patch: Partial<Pick<SettingsRow, "llmProvider" | "llmApiKey" | "llmModel">>) {
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

export type SettingsDaoInstance = ReturnType<typeof createSettingsDao>;
