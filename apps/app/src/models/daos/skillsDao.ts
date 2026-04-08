import { eq, desc } from "drizzle-orm";
import type { PostgresJsDatabase, PostgresJsTransaction } from "drizzle-orm/postgres-js";
import { db } from "@/db";
import { skillsTable, type NewSkillRow, type SkillRow } from "@/models/tables/skills_table";

export type SkillEntity = Omit<SkillRow, "createdAt" | "updatedAt"> & {
  createdAt: number;
  updatedAt: number;
};

type DbExecutor =
  | PostgresJsDatabase<Record<string, unknown>>
  | PostgresJsTransaction<Record<string, unknown>, Record<string, never>>;

const rowToEntity = (row: SkillRow): SkillEntity => {
  return {
    ...row,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
};

export const skillsDao = {
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
    const row: NewSkillRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(skillsTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async createWithTx(
    tx: DbExecutor,
    data: Omit<SkillEntity, "createdAt" | "updatedAt">
  ): Promise<SkillEntity> {
    const now = new Date();
    const row: NewSkillRow = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await tx.insert(skillsTable).values(row).returning();
    return rowToEntity(inserted);
  },

  async update(
    id: string,
    patch: Partial<Omit<SkillEntity, "createdAt" | "updatedAt">>
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

  async updateWithTx(
    tx: DbExecutor,
    id: string,
    patch: Partial<Omit<SkillEntity, "createdAt" | "updatedAt">>
  ): Promise<SkillEntity | null> {
    const updates: Partial<NewSkillRow> = { updatedAt: new Date() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.label !== undefined) updates.label = patch.label;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.category !== undefined) updates.category = patch.category;
    if (patch.tags !== undefined) updates.tags = patch.tags;
    const [updated] = await tx
      .update(skillsTable)
      .set(updates)
      .where(eq(skillsTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  },

  async delete(id: string): Promise<void> {
    await db.delete(skillsTable).where(eq(skillsTable.id, id));
  },

  async deleteWithTx(tx: DbExecutor, id: string): Promise<void> {
    await tx.delete(skillsTable).where(eq(skillsTable.id, id));
  },

  async seedIfEmpty(): Promise<void> {
    const existing = await db.select().from(skillsTable).limit(1);
    if (existing.length > 0) return;

    const seedData = [
      {
        id: "skill-001",
        name: "page-best-practice",
        label: "页面结构",
        description:
          "生成标准的页面 Anatomy：Wrapper + Content + 可选 Store，确保页面结构清晰分层。",
        category: "page",
        tags: ["React", "Anatomy", "Layout"],
      },
      {
        id: "skill-002",
        name: "store-best-practice",
        label: "状态管理 Store",
        description: "基于 Zustand slice 模式创建 Store，包含 Context Provider 和类型安全的 hook。",
        category: "state",
        tags: ["Zustand", "Slice", "Context"],
      },
      {
        id: "skill-003",
        name: "dao-best-practice",
        label: "DAO 层",
        description: "使用 Drizzle ORM 规范创建数据访问对象，确保命名、类型安全和查询性能。",
        category: "data",
        tags: ["Drizzle", "ORM", "Database"],
      },
      {
        id: "skill-004",
        name: "service-best-practice",
        label: "Service 层",
        description: "按照 tRPC + Service + DAO 架构创建 Service，分离业务逻辑与数据访问。",
        category: "data",
        tags: ["tRPC", "Service", "Architecture"],
      },
      {
        id: "skill-005",
        name: "form-best-practice",
        label: "表单组件",
        description: "创建符合规范的表单组件，包含字段验证、状态管理和 UI 结构。",
        category: "form",
        tags: ["Form", "Validation", "UX"],
      },
      {
        id: "skill-006",
        name: "schema-best-practice",
        label: "Schema 校验",
        description: "使用 Drizzle ORM schema 定义数据库表，确保命名、关系和索引配置规范。",
        category: "data",
        tags: ["Schema", "Drizzle", "Types"],
      },
      {
        id: "skill-007",
        name: "barrel-export-best-practice",
        label: "桶导出规范",
        description: "生成和检查 index.ts 桶导出文件，确保所有 index 文件仅做 re-export。",
        category: "code-quality",
        tags: ["Exports", "Index", "Module"],
      },
      {
        id: "skill-008",
        name: "error-handling-best-practice",
        label: "错误处理",
        description: "规范化 try-catch 写法，确保 catch 块有实质处理逻辑，不为空或仅记录日志。",
        category: "code-quality",
        tags: ["Error", "Try-Catch", "Safety"],
      },
      {
        id: "skill-009",
        name: "db-table-best-practice",
        label: "数据库表命名",
        description: "验证和修正数据库表定义的命名规范，包括表名、列名和索引。",
        category: "data",
        tags: ["Database", "Naming", "Schema"],
      },
      {
        id: "skill-010",
        name: "svg-icon-best-practice",
        label: "SVG 图标规范",
        description: "管理 React TypeScript 项目中的 SVG 图标，确保命名、封装和导出规范。",
        category: "code-quality",
        tags: ["SVG", "Icons", "Components"],
      },
      {
        id: "skill-011",
        name: "one-component-per-file-best-practice",
        label: "单组件单文件",
        description: "强制每个文件只包含一个 React/Vue 组件，不允许多组件共存。",
        category: "code-quality",
        tags: ["Components", "Structure", "React"],
      },
      {
        id: "skill-012",
        name: "refine-trpc-best-practice",
        label: "Refine tRPC 规范",
        description:
          "在 React 组件中通过 Refine hooks 经由 DataProvider 访问数据，禁止直接调用 tRPC。",
        category: "data",
        tags: ["Refine", "tRPC", "DataProvider"],
      },
    ];

    const now = new Date();
    const rows: NewSkillRow[] = seedData.map((s) => ({
      ...s,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(skillsTable).values(rows);
  },
};
