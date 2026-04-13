/**
 * Seed: Best Practices
 *
 * Seeds the `best_practices` table with entries derived from `.agents/skills/*-best-practice/`.
 * Also includes 3 workflow-level practices referenced by recipes.
 *
 * Requirements:
 *   - Title must be "xxx最佳实践"
 *   - Must have codeSnippet
 *   - Checklist items seeded separately in checklist-items.ts
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

// ─── Best Practices Data ─────────────────────────────────────────────────────

const BEST_PRACTICES: BestPracticeSeed[] = [
  {
    id: "bp_barrel_export",
    title: "桶导出最佳实践",
    condition: "编写或审查 index.ts/index.js 桶导出文件",
    content: "确保所有导出遵循只做 re-export、无业务逻辑、命名导出等规范。",
    category: "architecture",
    language: "typescript",
    codeSnippet: `// ✅ Good: Pure re-exports only
export * from './Button'
export * from './Input'

// ❌ Bad: Business logic in index
export const API_BASE = '/api/v1'

// ❌ Bad: Default export
export default Button`,
    tags: ["barrel-export", "index", "module"],
  },
  {
    id: "bp_checklist",
    title: "检查清单最佳实践",
    condition: "为 Skill 或项目模块编写检查清单（checklist.md）",
    content: "确保每一项可判断、有示例、结构清晰、支持自动化验证。",
    category: "process",
    language: "markdown",
    codeSnippet: `// ✅ Good: 可判定 + 有示例
// - [ ] 1.1 文件名格式为 {feature}Dao.ts
//   - ❌ 错误：CatsDAO.ts
//   - ✅ 正确：catsDao.ts
// ❌ Bad: 模糊不可判定
// - [ ] 命名要规范`,
    tags: ["checklist", "quality"],
  },
  {
    id: "bp_component_design",
    title: "组件设计最佳实践",
    condition: "设计或审查 React 组件",
    content: "确保组件符合 shadcn/ui 设计哲学：单一职责、可组合、可访问、可复制粘贴。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `// ❌ Bad: 配置驱动
// <Tabs tabs={[{ id: "profile", label: "资料", content: <Profile /> }]} />
// ✅ Good: 组合驱动
// <Tabs defaultValue="profile">
//   <TabsList><TabsTrigger value="profile">资料</TabsTrigger></TabsList>
//   <TabsContent value="profile"><Profile /></TabsContent>
// </Tabs>`,
    tags: ["react", "component", "shadcn"],
  },
  {
    id: "bp_component_unit",
    title: "组件单元最佳实践",
    condition: "创建或审查 React 组件文件夹单元",
    content: "强制每个组件以独立文件夹形式存在，包含组件本身、单元测试和 Storybook 故事文件。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `// ComponentName/
// ├── index.ts                    // export * from './ComponentName'
// ├── ComponentName.tsx           // 组件本身
// ├── ComponentName.test.tsx      // 单元测试
// └── ComponentName.stories.tsx   // Storybook 故事
// ❌ Bad: 单文件无文件夹
// ❌ Bad: 测试放在 __tests__/`,
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
    const result = await db.select().from(usersTable)
      .where(eq(usersTable.id, id)).limit(1);
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
    codeSnippet: `// ✅ Good: SQL snake_case 复数 + TS camelCase + Table 后缀
export const usersTable = pgTable("users", {
  createdAt: timestamp("created_at"),
  emailVerified: boolean("email_verified"),
});
// ❌ Bad: 驼峰表名 / 单数 / 缺 Table 后缀
// export const user = pgTable("User", { createdAt: timestamp("createdAt") });`,
    tags: ["database", "schema", "drizzle", "naming"],
  },
  {
    id: "bp_error_handling",
    title: "错误处理最佳实践",
    condition: "编写错误处理代码",
    content: "必须使用 neverthrow 库进行函数式错误处理，禁止使用原生 try-catch。",
    category: "backend",
    language: "typescript",
    codeSnippet: `// ✅ Good: neverthrow Result 类型
function parseJSON(raw: string): Result<Data, ParseError> {
  try { return ok(JSON.parse(raw)); }
  catch { return err(new ParseError("Invalid JSON", raw)); }
}
result.match(
  (user) => console.log(user.name),
  (error) => console.error(error.message)
);
// ❌ Bad: 原生 try-catch + 静默捕获
// try { await fetchUser() } catch (e) { console.log(e) }`,
    tags: ["error-handling", "neverthrow", "result"],
  },
  {
    id: "bp_form",
    title: "表单最佳实践",
    condition: "创建或重构前端表单组件",
    content: "确保表单结构、字段验证逻辑和状态管理遵循项目表单设计规范与组件化标准。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `const FormSchema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid"),
});

export function MyForm({ initialData, onSubmit }: MyFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { ...initialData },
  });
  // <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)}>
  //   <FormField control={form.control} name="name" render={...} />
  // </form></Form>
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
i18n.use(LanguageDetector).use(initReactI18next).init({
  resources,
  lng: getSavedLanguage() || undefined,
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
    language: "typescript",
    codeSnippet: `// ✅ Good: 每个文件只导出一个组件
// UserCard.tsx -> export const UserCard = () => { ... };
// Avatar.tsx  -> export const Avatar = () => { ... };
// ❌ Bad: 一个文件多组件
// UserCard.tsx
// export const UserCard = () => { ... };
// export const Avatar = () => { ... }; // 必须拆到 Avatar.tsx`,
    tags: ["react", "component", "file-structure"],
  },
  {
    id: "bp_page",
    title: "页面结构最佳实践",
    condition: "创建或审查前端页面结构",
    content: "确保遵循 Anatomy 规范，正确分离 Wrapper、Content 和 Optional Store 模块。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `// ConfigPage/
// ├── index.ts
// ├── ConfigPage.tsx           // Wrapper
// ├── ConfigPageContent.tsx    // Content
// └── _store/
//     ├── provider.tsx
//     ├── configPageSlice.ts
//     └── configPageStore.ts
export const ConfigPage = () => (
  <ConfigPageStoreProvider><ConfigPageContent /></ConfigPageStoreProvider>
);`,
    tags: ["page", "architecture", "anatomy"],
  },
  {
    id: "bp_refine_trpc",
    title: "Refine tRPC 数据获取最佳实践",
    condition: "在 React 组件中进行数据获取",
    content: "确保通过 Refine hooks 经由 DataProvider 访问数据，禁止直接调用 trpc 客户端。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `// ✅ Good: 通过 Refine hooks 访问数据
// const { data } = useList({ resource: "users" });
// const { mutate } = useCreate();
// ❌ Bad: 直接使用 tRPC 客户端
// const { data } = trpc.users.list.useQuery();
// ❌ Bad: 绕过 Refine
// import { useQuery } from "@tanstack/react-query";`,
    tags: ["refine", "trpc", "data-provider"],
  },
  {
    id: "bp_repository",
    title: "Repository 层最佳实践",
    condition: "创建或重构 Repository 层",
    content: "确保数据访问模式、方法命名、返回类型和接口定义符合项目规范。",
    category: "backend",
    language: "typescript",
    codeSnippet: `export const FreeBattleRepository = {
  async create(input: CreateFreeBattleInput): Promise<{ id: number }> {
    return await db.transaction(async (tx) => {
      const battleId = await battlesDAO.createWithTx(tx, {
        title: input.title, type: "free",
      });
      await freeBattlesDAO.createWithTx(tx, {
        battle_id: battleId, rules: input.rules,
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
    codeSnippet: `// ✅ Good: 一文件一 Schema + z.infer 派生
export const CatSchema = z.object({ id: z.string(), name: z.string() });
export type Cat = z.infer<typeof CatSchema>;
export const CreateCatInputSchema = CatSchema.omit({ id: true });
export type CreateCatInput = z.infer<typeof CreateCatInputSchema>;
// ❌ Bad: 手写 interface
// interface Cat { id: string; name: string }`,
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
    if (existing) throw new Error("Cat already exists");
    return await catsDao.create({ ...data, userId });
  },
};
// ❌ Bad: Service 直接 import db
// ❌ Bad: 业务校验下沉到 DAO`,
    tags: ["service", "trpc", "architecture"],
  },
  {
    id: "bp_skill",
    title: "Skill 质量验证最佳实践",
    condition: "创建或修改 Skill 后执行质量验证",
    content: "涵盖命名、目录结构、元数据完整性、临时文件清理和依赖格式共 16 项检查。",
    category: "process",
    language: "markdown",
    codeSnippet: `// ---
// name: dao-best-practice
// description: Must follow when 创建或重构 DAO 文件。
// ---
// ❌ Bad: name 与目录名不一致
// ❌ Bad: description 未以 Must follow 开头
// ❌ Bad: 目录名用大写或下划线`,
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
});
// ❌ Bad: Store 包含 loading/error 异步状态
// ❌ Bad: 方法命名 setXxx 而非 handleXxx`,
    tags: ["zustand", "store", "state-management"],
  },
  {
    id: "bp_storybook",
    title: "Storybook 最佳实践",
    condition: "创建或维护 Storybook Stories",
    content: "确保组件文档命名、参数定义和装饰器配置符合项目 Storybook 编写规范。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `const meta: Meta<typeof CatCard> = {
  title: "Components/CatCard",
  component: CatCard,
  args: { onSave: fn() },
};
export default meta;
type Story = StoryObj<typeof CatCard>;
export const Base: Story = { args: { name: "柠檬", desc: "慵懒的橘猫" } };
export const Default: Story = { args: {} };`,
    tags: ["storybook", "documentation", "component"],
  },
  {
    id: "bp_svg_icon",
    title: "SVG 图标最佳实践",
    condition: "管理或新增 React TypeScript 项目中的 SVG 图标组件",
    content: "确保命名、封装方式和导出规范遵循项目标准规范。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `import type { SVGProps } from "react";
export const ArrowRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth={2} />
  </svg>
);
// ❌ Bad: 内联 <svg> / 硬编码 fill / export default`,
    tags: ["svg", "icon", "component"],
  },
  {
    id: "bp_ui_components",
    title: "UI 组件库使用最佳实践",
    condition: "创建或审查 UI 组件代码",
    content: "确保在标准场景下使用项目组件库组件（shadcn/ui），禁止直接使用原生 HTML 元素。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `// ❌ Bad: 原生 HTML 元素
// <button onClick={handleClick}>提交</button>
// <input type="text" value={v} onChange={onChange} />
// ✅ Good: 组件库组件
// <Button onClick={handleClick}>提交</Button>
// <Input value={v} onChange={onChange} />
// <Select><SelectTrigger /><SelectContent>...</SelectContent></Select>`,
    tags: ["ui", "shadcn", "component-library"],
  },
  {
    id: "bp_use_store_not_props",
    title: "Store 优先于 Props 最佳实践",
    condition: "设计组件数据流",
    content: "优先通过 Store 访问全局状态，不得通过 Props 层层传递。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `// ❌ Bad: 从 store 读出再通过 props 传入
// const selectedCat = useCatsStore(s => s.selectedCat);
// return <CatCard cat={selectedCat} />;
// ✅ Good: 子组件直接从 store 读取
const CatCard = () => {
  const cat = useCatsPageStore(s => s.selectedCat);
  return <div>{cat.name}</div>;
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
    codeSnippet: `// ✅ Good: 从 Zod schema 派生
export const UserSchema = z.object({ id: z.string(), name: z.string() });
export type User = z.infer<typeof UserSchema>;
export const CreateUserSchema = UserSchema.omit({ id: true });
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
// ❌ Bad: 手写 interface
// export interface User { id: string; name: string }`,
    tags: ["zod", "type", "schema"],
  },
  {
    id: "bp_clean_hardcode",
    title: "代码清理最佳实践",
    condition: "检查代码是否存在垃圾代码",
    content: "包括未使用导入、注释代码段、console.log、死代码、空函数、重复代码等。",
    category: "lint",
    language: "typescript",
    codeSnippet: `// ❌ Bad examples:
// import { unused } from './utils';  // 未使用的导入
// console.log("debug:", data);       // console 残留
// const oldHandler = () => { ... };  // 注释掉的代码
// function onReady() {}              // 空函数
// ✅ Good: 干净的代码，无以上问题`,
    tags: ["clean-code", "hardcode", "lint"],
  },
  {
    id: "bp_classname_convention",
    title: "ClassName 转换最佳实践",
    condition: "检查 className 是否使用模板字符串",
    content: "所有动态 className 必须使用 cn() 函数，禁止模板字符串拼接。",
    category: "frontend",
    language: "typescript",
    codeSnippet: `import { cn } from "@/lib/utils";
// ✅ Good: cn() 函数
// <div className={cn("px-4", isActive && "bg-blue-500")} />
// ❌ Bad: 模板字符串拼接
// <div className={\`px-4 \${isActive ? "bg-blue-500" : ""}\`} />
// ❌ Bad: 字符串连接
// <div className={"base " + conditionalClass} />`,
    tags: ["classname", "cn", "tailwind"],
  },
  {
    id: "bp_full_check_workflow",
    title: "全量检查流程最佳实践",
    condition: "需要对项目进行全量最佳实践检查",
    content: "自动发现并依次执行所有以 best-practice 结尾的技能，输出汇总报告。",
    category: "process",
    language: "typescript",
    codeSnippet: `// 1. 扫描 .agents/skills/*-best-practice/
// 2. 对每个 best-practice 依次执行检查
// 3. 收集所有违规项，输出汇总报告
// { "total": 22, "passed": 18, "failed": 4,
//   "violations": [{ "practice": "barrel-export", "file": "...", "message": "..." }] }`,
    tags: ["full-check", "workflow", "automation"],
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding best practices via REST API...\n");

  let upserted = 0;

  for (const bp of BEST_PRACTICES) {
    await apiPut("/api/best-practices", bp);
    console.log(`  ✅  ${bp.id} — ${bp.title} — upserted`);
    upserted++;
  }

  // Cleanup known duplicate entries
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
