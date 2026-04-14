import { eq, desc } from "drizzle-orm";
import { skillsTable } from "@repo/db-schema";
import type { NewSkillRow, SkillRow } from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

export type SkillEntity = Omit<SkillRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

const rowToEntity = (row: SkillRow): SkillEntity => ({
  ...row,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
});

export const createSkillsDao = (db: DbExecutor) => ({
  async findMany(): Promise<SkillEntity[]> {
    const rows = await db.select().from(skillsTable).orderBy(desc(skillsTable.updatedAt));
    return rows.map(rowToEntity);
  },

  async findById(id: string): Promise<SkillEntity | null> {
    const rows = await db.select().from(skillsTable).where(eq(skillsTable.id, id)).limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async findByName(name: string): Promise<SkillEntity | null> {
    const rows = await db.select().from(skillsTable).where(eq(skillsTable.name, name)).limit(1);
    return rows[0] ? rowToEntity(rows[0]) : null;
  },

  async create(data: Omit<SkillEntity, "createdAt" | "updatedAt">): Promise<SkillEntity> {
    const now = new Date();
    const row: NewSkillRow = { ...data, createdAt: now, updatedAt: now };
    const [inserted] = await db.insert(skillsTable).values(row).returning();
    if (!inserted) throw new Error("Failed to insert skill");
    return rowToEntity(inserted);
  },

  async update(
    id: string,
    patch: Partial<Omit<SkillEntity, "createdAt" | "updatedAt">>,
  ): Promise<SkillEntity | null> {
    const updates: Partial<NewSkillRow> = { updatedAt: new Date() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.label !== undefined) updates.label = patch.label;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.category !== undefined) updates.category = patch.category;
    if (patch.tags !== undefined) updates.tags = patch.tags;
    const [updated] = await db
      .update(skillsTable)
      .set(updates)
      .where(eq(skillsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(skillsTable).where(eq(skillsTable.id, id));
  },
});
