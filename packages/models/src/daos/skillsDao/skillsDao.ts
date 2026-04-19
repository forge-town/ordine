import { eq, desc } from "drizzle-orm";
import { skillsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

class SkillsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(skillsTable).orderBy(desc(skillsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(skillsTable)
      .where(eq(skillsTable.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async findByName(name: string) {
    const rows = await this.executor
      .select()
      .from(skillsTable)
      .where(eq(skillsTable.name, name))
      .limit(1);

    return rows[0] ?? null;
  }

  async create(data: typeof skillsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(skillsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof skillsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(skillsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(skillsTable.id, id))
      .returning();

    return updated ?? null;
  }

  async delete(id: string) {
    await this.executor.delete(skillsTable).where(eq(skillsTable.id, id));
  }

  async seedIfEmpty() {
    const existing = await this.executor.select().from(skillsTable).limit(1);
    if (existing.length > 0) return;

    const seedData = [
      {
        id: "skill-001",
        name: "page-best-practice",
        label: "Page Structure",
        description:
          "Generate standard page Anatomy: Wrapper + Content + optional Store, ensuring clear layered page structure.",
        category: "page",
        tags: ["React", "Anatomy", "Layout"],
      },
      {
        id: "skill-002",
        name: "store-best-practice",
        label: "State Management Store",
        description:
          "Create Store based on Zustand slice pattern, including Context Provider and type-safe hooks.",
        category: "state",
        tags: ["Zustand", "Slice", "Context"],
      },
      {
        id: "skill-003",
        name: "dao-best-practice",
        label: "DAO Layer",
        description:
          "Create data access objects using Drizzle ORM standards, ensuring naming, type safety and query performance.",
        category: "data",
        tags: ["Drizzle", "ORM", "Database"],
      },
      {
        id: "skill-004",
        name: "service-best-practice",
        label: "Service Layer",
        description:
          "Create Service following tRPC + Service + DAO architecture, separating business logic from data access.",
        category: "data",
        tags: ["tRPC", "Service", "Architecture"],
      },
      {
        id: "skill-005",
        name: "form-best-practice",
        label: "Form Components",
        description:
          "Create form components following standards, including field validation, state management and UI structure.",
        category: "form",
        tags: ["Form", "Validation", "UX"],
      },
      {
        id: "skill-006",
        name: "schema-best-practice",
        label: "Schema Validation",
        description:
          "Define database tables using Drizzle ORM schema, ensuring naming, relationships and index configuration standards.",
        category: "data",
        tags: ["Schema", "Drizzle", "Types"],
      },
      {
        id: "skill-007",
        name: "barrel-export-best-practice",
        label: "Barrel Export",
        description:
          "Generate and check index.ts barrel export files, ensuring all index files only do re-export.",
        category: "code-quality",
        tags: ["Exports", "Index", "Module"],
      },
      {
        id: "skill-008",
        name: "error-handling-best-practice",
        label: "Error Handling",
        description:
          "Standardize neverthrow-based error handling, keeping errors explicit and eliminating try-catch from application code.",
        category: "code-quality",
        tags: ["Error", "Neverthrow", "Safety"],
      },
      {
        id: "skill-009",
        name: "db-table-best-practice",
        label: "Database Table Naming",
        description:
          "Verify and correct database table definition naming standards, including table names, column names and indexes.",
        category: "data",
        tags: ["Database", "Naming", "Schema"],
      },
      {
        id: "skill-010",
        name: "svg-icon-best-practice",
        label: "SVG Icon Standards",
        description:
          "Manage SVG icons in React TypeScript projects, ensuring naming, encapsulation and export standards.",
        category: "code-quality",
        tags: ["SVG", "Icons", "Components"],
      },
      {
        id: "skill-011",
        name: "one-component-per-file-best-practice",
        label: "One Component Per File",
        description:
          "Enforce one React/Vue component per file, no multiple components in one file.",
        category: "code-quality",
        tags: ["Components", "Structure", "React"],
      },
      {
        id: "skill-012",
        name: "refine-trpc-best-practice",
        label: "Refine tRPC Standards",
        description:
          "Access data in React components through Refine hooks via DataProvider, no direct tRPC calls.",
        category: "data",
        tags: ["Refine", "tRPC", "DataProvider"],
      },
    ];

    const now = new Date();
    const rows = seedData.map((s) => ({
      ...s,
      createdAt: now,
      updatedAt: now,
    }));

    await this.executor.insert(skillsTable).values(rows).onConflictDoNothing();
  }
}

export const createSkillsDao = (executor: DbExecutor) => {
  return new SkillsDao(executor);
};

export type SkillsDaoInstance = ReturnType<typeof createSkillsDao>;
