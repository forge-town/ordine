import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settingsTable, type SettingsRow } from "@/models/tables/settings_table";

export type SettingsEntity = Omit<SettingsRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

const rowToEntity = (row: SettingsRow): SettingsEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

const DEFAULT_ID = "default";

export const settingsDao = {
  async get(): Promise<SettingsEntity> {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, DEFAULT_ID))
      .limit(1);

    if (rows.length > 0) return rowToEntity(rows[0]);

    // Auto-create default row if none exists
    const [created] = await db.insert(settingsTable).values({ id: DEFAULT_ID }).returning();
    return rowToEntity(created);
  },

  async update(
    patch: Partial<Pick<SettingsRow, "llmProvider" | "llmApiKey" | "llmModel">>
  ): Promise<SettingsEntity> {
    // Ensure default row exists
    await this.get();

    const [updated] = await db
      .update(settingsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(settingsTable.id, DEFAULT_ID))
      .returning();
    return rowToEntity(updated);
  },
};
