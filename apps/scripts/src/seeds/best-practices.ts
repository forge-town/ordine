/**
 * Seed: Best Practices
 *
 * Seeds the `best_practices` table with entries derived from `.agents/skills/*-best-practice/`.
 * Also includes 3 workflow-level practices referenced by recipes.
 */

import { apiPut, apiDelete } from "../api";

interface BestPracticeSeed {
  id: string;
  title: string;
  condition: string;
  content: string;
  category: string;
  language: string;
  codeSnippet: string;
  tags: string[];
}

const BEST_PRACTICES: BestPracticeSeed[] = [
  {
    id: "bp_barrel_export",
    title: "桶导出最佳实践",
    condition: "编写或审查 index.ts/index.js 桶导出文件",
    content: "确保所有导出遵循只做 re-export、无业务逻辑、命名导出等规范。",
    category: "architecture",
    language: "typescript",
    codeSnippet: `export * from "./Button";
export * from "./Input";
export * from "./Select";
export * from "./Dialog";`,
    tags: ["barrel-export", "index", "module"],
  },
  {
    id: "bp_checklist",
    title: "检查清单最佳实践",
    condition: "为 Skill 或项目模块编写检查清单（checklist.md）",
    content: "确保每一项可判断、有示例、结构清晰、支持自动化验证。",
    category: "process",
    language: "markdown",
    codeSnippet: `- [ ] 1.1 文件名格式为 {feature}Dao.ts
  - 正确：catsDao.ts
  - 错误：CatsDAO.ts
- [ ] 1.2 查询单条返回 T | null
  - 正确：findById(id: string): Promise<UserRow | null>
  - 错误：findById(id: string): Promise<UserRow>`,
    tags: ["checklist", "quality"],
  },
  {
    id: "bp_component_design",
    title: "组件设计最佳实践",
    condition: "设计或审查 React 组件",
    content: "确保组件符合 shadcn/ui 设计哲学：单一职责、可组合、可访问、可复制粘贴。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `<Tabs defaultValue="profile">
  <TabsList>
    <TabsTrigger value="profile">资料</TabsTrigger>
    <TabsTrigger value="settings">设置</TabsTrigger>
  </TabsList>
  <TabsContent value="profile">
    <Profile />
  </TabsContent>
  <TabsContent value="settings">
    <Settings />
  </TabsContent>
</Tabs>`,
    tags: ["react", "component", "shadcn"],
  },
  {
    id: "bp_component_unit",
    title: "组件单元最佳实践",
    condition: "创建或审查 React 组件文件夹单元",
    content: "强制每个组件以独立文件夹形式存在，包含组件本身、单元测试和 Storybook 故事文件。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `UserCard/
├── index.ts                   -> export * from "./UserCard";
├── UserCard.tsx
├── UserCard.test.tsx
└── UserCard.stories.tsx`,
    tags: ["react", "component", "test", "storybook"],
  },
  {
    id: "bp_dao",
    title: "DAO 最佳实践",
    condition: "创建或重构 DAO 文件",
    content: "确保遵循 Drizzle ORM 最佳实践（文件结构、方法命名、类型安全、性能优化）。",
    category: "backend",
    language: "typescript",
    codeSnippet: `export const usersDao = {
  async findById(id: string): Promise<UserRow | null> {
    const result = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    return result[0] ?? null;
  },

  async create(data: NewUserRow): Promise<UserRow> {
    const result = await db.insert(usersTable).values(data).returning();
    return result[0];
  },

  async createWithTx(tx: DbExecutor, data: NewUserRow): Promise<UserRow> {
    const result = await tx.insert(usersTable).values(data).returning();
    return result[0];
  },
};`,
    tags: ["dao", "drizzle", "database"],
  },
  {
    id: "bp_db_table",
    title: "数据库表定义最佳实践",
    condition: "创建或审查 Drizzle ORM 数据库表定义",
    content: "确保表名、列名、索引和关系配置均遵循项目命名规范与表结构规范。",
    category: "backend",
    language: "typescript",
    codeSnippet: `export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  emailVerified: boolean("email_verified").default(false),
});`,
    tags: ["database", "schema", "drizzle", "naming"],
  },
  {
    id: "bp_error_handling",
    title: "错误处理最佳实践",
    condition: "编写错误处理代码",
    content: "必须使用 neverthrow 库进行函数式错误处理，禁止使用原生 try-catch。",
    category: "backend",
    language: "typescript",
    codeSnippet: `import { ok, err, Result } from "neverthrow";

function parseJSON(raw: string): Result<Data, ParseError> {
  try {
    return ok(JSON.parse(raw));
  } catch {
    return err(new ParseError("Invalid JSON", raw));
  }
}

parseJSON(input).match(
  (data) => handleSuccess(data),
  (error) => handleError(error.message),
);`,
    tags: ["error-handling", "neverthrow", "result"],
  },
  {
    id: "bp_form",
    title: "表单最佳实践",
    condition: "创建或重构前端表单组件",
    content: "确保表单结构、字段验证逻辑和状态管理遵循项目表单设计规范与组件化标准。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `const FormSchema = z.object({
  name: z.string().min(1, "必填"),
  email: z.string().email("邮箱格式不正确"),
});

export function MyForm({ initialData, onSubmit }: MyFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { ...initialData },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>名称</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}`,
    tags: ["form", "validation", "react"],
  },
  {
    id: "bp_i18n",
    title: "国际化最佳实践",
    condition: "创建或重构 i18n 国际化代码",
    content: "确保遵循 react-i18next 最佳实践。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh",
    interpolation: { escapeValue: false },
    detection: { order: ["cookie", "localStorage", "navigator"] },
  });`,
    tags: ["i18n", "react-i18next", "localization"],
  },
  {
    id: "bp_one_component_per_file",
    title: "一文件一组件最佳实践",
    condition: "检查或重构 React/Vue 组件文件",
    content: "强制每个文件只包含一个组件，不允许多组件共存于同一文件。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `export const UserCard = ({ userId }: UserCardProps) => {
  const user = useUserStore((s) => s.users[userId]);

  return (
    <Card>
      <CardHeader>
        <Avatar src={user.avatar} />
      </CardHeader>
      <CardContent>{user.name}</CardContent>
    </Card>
  );
};`,
    tags: ["react", "component", "file-structure"],
  },
  {
    id: "bp_page",
    title: "页面结构最佳实践",
    condition: "创建或审查前端页面结构",
    content: "确保遵循 Anatomy 规范，正确分离 Wrapper、Content 和 Optional Store 模块。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `ConfigPage/
├── index.ts
├── ConfigPage.tsx
├── ConfigPageContent.tsx
└── _store/
    ├── provider.tsx
    ├── configPageSlice.ts
    └── configPageStore.ts

export const ConfigPage = () => (
  <ConfigPageStoreProvider>
    <ConfigPageContent />
  </ConfigPageStoreProvider>
);`,
    tags: ["page", "architecture", "anatomy"],
  },
  {
    id: "bp_refine_trpc",
    title: "Refine tRPC 数据获取最佳实践",
    condition: "在 React 组件中进行数据获取",
    content: "确保通过 Refine hooks 经由 DataProvider 访问数据，禁止直接调用 trpc 客户端。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `const { data: users } = useList({
  resource: "users",
  filters: [{ field: "role", operator: "eq", value: "admin" }],
});

const { mutate: createUser } = useCreate();

const handleSubmit = (values: CreateUserInput) => {
  createUser({ resource: "users", values });
};`,
    tags: ["refine", "trpc", "data-provider"],
  },
  {
    id: "bp_repository",
    title: "Repository 层最佳实践",
    condition: "创建或重构 Repository 层",
    content: "确保数据访问模式、方法命名、返回类型和接口定义符合项目规范。",
    category: "backend",
    language: "typescript",
    codeSnippet: `export const freeBattleRepository = {
  async create(input: CreateFreeBattleInput): Promise<{ id: number }> {
    return await db.transaction(async (tx) => {
      const battleId = await battlesDao.createWithTx(tx, {
        title: input.title,
        type: "free",
      });
      await freeBattlesDao.createWithTx(tx, {
        battleId,
        rules: input.rules,
      });
      return { id: battleId };
    });
  },
};`,
    tags: ["repository", "data-access"],
  },
  {
    id: "bp_schema",
    title: "Schema 定义最佳实践",
    condition: "创建或重构数据库 Schema 定义",
    content: "确保 Drizzle ORM schema 中的命名、关系和索引配置均符合规范。",
    category: "backend",
    language: "typescript",
    codeSnippet: `export const CatSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  breed: z.string().optional(),
  ownerId: z.string(),
});
export type Cat = z.infer<typeof CatSchema>;

export const CreateCatInputSchema = CatSchema.omit({ id: true });
export type CreateCatInput = z.infer<typeof CreateCatInputSchema>;`,
    tags: ["schema", "drizzle", "database"],
  },
  {
    id: "bp_service",
    title: "Service 层最佳实践",
    condition: "创建或重构 Service 层",
    content: "基于 tRPC + Service + DAO 架构确保依赖注入、错误处理和业务逻辑分层符合规范。",
    category: "backend",
    language: "typescript",
    codeSnippet: `export const catsService = {
  async create(userId: string, data: CreateCatInput): Promise<Cat> {
    const existing = await catsDao.findByName(data.name);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Cat already exists" });
    }
    return await catsDao.create({ ...data, ownerId: userId });
  },

  async listByOwner(ownerId: string): Promise<Cat[]> {
    return await catsDao.findByOwnerId(ownerId);
  },
};`,
    tags: ["service", "trpc", "architecture"],
  },
  {
    id: "bp_skill",
    title: "Skill 质量验证最佳实践",
    condition: "创建或修改 Skill 后执行质量验证",
    content: "涵盖命名、目录结构、元数据完整性、临时文件清理和依赖格式共 16 项检查。",
    category: "process",
    language: "yaml",
    codeSnippet: `---
name: dao-best-practice
description: >-
  Must follow when 创建或重构 DAO 文件，确保遵循 Drizzle ORM
  最佳实践（文件结构、方法命名、类型安全、性能优化）。
---`,
    tags: ["skill", "quality", "validation"],
  },
  {
    id: "bp_store",
    title: "Zustand Store 最佳实践",
    condition: "使用 Zustand 创建或重构状态管理 Store",
    content: "确保遵循 slice 模式、Provider 设置和类型安全规范。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `export interface AppLayoutSlice {
  sidebarOpen: boolean;
  handleSetSidebarOpen: (open: boolean) => void;
}

export const createAppLayoutSlice: StateCreator<AppLayoutSlice> = (set) => ({
  sidebarOpen: false,
  handleSetSidebarOpen: (open) => set({ sidebarOpen: open }),
});`,
    tags: ["zustand", "store", "state-management"],
  },
  {
    id: "bp_storybook",
    title: "Storybook 最佳实践",
    condition: "创建或维护 Storybook Stories",
    content: "确保组件文档命名、参数定义和装饰器配置符合项目 Storybook 编写规范。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `const meta: Meta<typeof CatCard> = {
  title: "Components/CatCard",
  component: CatCard,
  args: { onSave: fn() },
};
export default meta;
type Story = StoryObj<typeof CatCard>;

export const Base: Story = {
  args: { name: "柠檬", desc: "慵懒的橘猫" },
};

export const Default: Story = { args: {} };`,
    tags: ["storybook", "documentation", "component"],
  },
  {
    id: "bp_svg_icon",
    title: "SVG 图标最佳实践",
    condition: "管理或新增 React TypeScript 项目中的 SVG 图标组件",
    content: "确保命名、封装方式和导出规范遵循项目标准规范。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `import type { SVGProps } from "react";

export const ArrowRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth={2} />
  </svg>
);`,
    tags: ["svg", "icon", "component"],
  },
  {
    id: "bp_ui_components",
    title: "UI 组件库使用最佳实践",
    condition: "创建或审查 UI 组件代码",
    content: "确保在标准场景下使用项目组件库组件（shadcn/ui），禁止直接使用原生 HTML 元素。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `<Button onClick={handleClick}>提交</Button>
<Input value={name} onChange={handleChange} />
<Select>
  <SelectTrigger>
    <SelectValue placeholder="选择角色" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="admin">管理员</SelectItem>
    <SelectItem value="user">普通用户</SelectItem>
  </SelectContent>
</Select>`,
    tags: ["ui", "shadcn", "component-library"],
  },
  {
    id: "bp_use_store_not_props",
    title: "Store 优先于 Props 最佳实践",
    condition: "设计组件数据流",
    content: "优先通过 Store 访问全局状态，不得通过 Props 层层传递。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `const CatCard = () => {
  const cat = useCatsPageStore((s) => s.selectedCat);

  return (
    <Card>
      <CardContent>
        <h3>{cat.name}</h3>
        <p>{cat.breed}</p>
      </CardContent>
    </Card>
  );
};`,
    tags: ["zustand", "props", "data-flow"],
  },
  {
    id: "bp_zod_infer_type",
    title: "Zod 类型派生最佳实践",
    condition: "项目中存在 Zod schema 定义时",
    content: "禁止另建 type.ts 文件重复声明类型；所有类型须直接用 z.infer 从 schema 派生。",
    category: "architecture",
    language: "typescript",
    codeSnippet: `export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({ id: true });
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = UserSchema.partial().required({ id: true });
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;`,
    tags: ["zod", "type", "schema"],
  },
  {
    id: "bp_clean_hardcode",
    title: "代码清理最佳实践",
    condition: "检查代码是否存在垃圾代码",
    content: "包括未使用导入、注释代码段、console.log、死代码、空函数、重复代码等。",
    category: "lint",
    language: "typescript",
    codeSnippet: `import { usersDao } from "@/models/daos/usersDao";

export const usersService = {
  async findById(id: string): Promise<UserRow | null> {
    return await usersDao.findById(id);
  },

  async create(data: CreateUserInput): Promise<UserRow> {
    return await usersDao.create(data);
  },
};`,
    tags: ["clean-code", "hardcode", "lint"],
  },
  {
    id: "bp_classname_convention",
    title: "ClassName 转换最佳实践",
    condition: "检查 className 是否使用模板字符串",
    content: "所有动态 className 必须使用 cn() 函数，禁止模板字符串拼接。",
    category: "frontend",
    language: "tsx",
    codeSnippet: `import { cn } from "@/lib/utils";

<div className={cn("px-4 py-2", isActive && "bg-blue-500", className)} />

<Button
  className={cn(
    "rounded-lg font-medium",
    variant === "primary" && "bg-primary text-white",
    variant === "ghost" && "bg-transparent",
    disabled && "opacity-50 cursor-not-allowed",
  )}
>
  {children}
</Button>`,
    tags: ["classname", "cn", "tailwind"],
  },
  {
    id: "bp_full_check_workflow",
    title: "全量检查流程最佳实践",
    condition: "需要对项目进行全量最佳实践检查",
    content: "自动发现并依次执行所有以 best-practice 结尾的技能，输出汇总报告。",
    category: "process",
    language: "typescript",
    codeSnippet: `const skills = discoverSkills(".agents/skills/*-best-practice/");

const results = await Promise.all(
  skills.map((skill) => runBestPracticeCheck(skill)),
);

const report = {
  total: results.length,
  passed: results.filter((r) => r.status === "passed").length,
  failed: results.filter((r) => r.status === "failed").length,
  violations: results.flatMap((r) => r.violations),
};`,
    tags: ["full-check", "workflow", "automation"],
  },
];

async function seed() {
  console.log("🌱 Seeding best practices via REST API...\n");

  let upserted = 0;

  for (const bp of BEST_PRACTICES) {
    await apiPut("/api/best-practices", bp);
    console.log(`  ✅  ${bp.id} — ${bp.title} — upserted`);
    upserted++;
  }

  const DUPLICATES = [
    "bp_useeffect",
    "bp_service_layer",
    "bp_dao_pattern",
    "bp_store_design",
    "bp_props_drilling",
  ];
  for (const id of DUPLICATES) {
    try {
      await apiDelete(`/api/best-practices/${id}`);
      console.log(`  🗑️  ${id} — deleted (duplicate)`);
    } catch {
      // ignore if not found
    }
  }

  console.log(`\n🎉 Done — ${upserted} best practices upserted.`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
