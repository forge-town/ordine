/**
 * Seed: Best Practices
 *
 * Seeds the `best_practices` table with entries derived from `.agents/skills/*-best-practice/`.
 * Also includes 3 workflow-level practices referenced by recipes.
 */

import { apiPut } from "../api";

interface BestPracticeSeed {
  id: string;
  title: string;
  condition: string;
  content: string;
  category: string;
  language: string;
  tags: string[];
}

// ─── Best Practices Data ─────────────────────────────────────────────────────

const BEST_PRACTICES: BestPracticeSeed[] = [
  // ── Skill-derived best practices ───────────────────────────────────────────
  {
    id: "bp_barrel_export",
    title: "桶导出规范",
    condition: "编写或审查 index.ts/index.js 桶导出文件",
    content: "确保所有导出遵循只做 re-export、无业务逻辑、命名导出等规范。",
    category: "architecture",
    language: "typescript",
    tags: ["barrel-export", "index", "module"],
  },
  {
    id: "bp_checklist",
    title: "检查清单规范",
    condition: "为 Skill 或项目模块编写检查清单（checklist.md）",
    content: "确保每一项可判断、有示例、结构清晰、支持自动化验证。",
    category: "process",
    language: "markdown",
    tags: ["checklist", "quality"],
  },
  {
    id: "bp_component_design",
    title: "组件设计规范",
    condition: "设计或审查 React 组件",
    content: "确保组件符合 shadcn/ui 设计哲学：单一职责、可组合、可访问、可复制粘贴。",
    category: "frontend",
    language: "typescript",
    tags: ["react", "component", "shadcn"],
  },
  {
    id: "bp_component_unit",
    title: "组件单元规范",
    condition: "创建或审查 React 组件文件夹单元",
    content: "强制每个组件以独立文件夹形式存在，包含组件本身、单元测试和 Storybook 故事文件。",
    category: "frontend",
    language: "typescript",
    tags: ["react", "component", "test", "storybook"],
  },
  {
    id: "bp_dao",
    title: "DAO 最佳实践",
    condition: "创建或重构 DAO 文件",
    content: "确保遵循 Drizzle ORM 最佳实践（文件结构、方法命名、类型安全、性能优化）。",
    category: "backend",
    language: "typescript",
    tags: ["dao", "drizzle", "database"],
  },
  {
    id: "bp_db_table",
    title: "数据库表定义规范",
    condition: "创建或审查 Drizzle ORM 数据库表定义",
    content: "确保表名、列名、索引和关系配置均遵循项目命名规范与表结构规范。",
    category: "backend",
    language: "typescript",
    tags: ["database", "schema", "drizzle", "naming"],
  },
  {
    id: "bp_error_handling",
    title: "错误处理规范",
    condition: "编写错误处理代码",
    content:
      "必须使用 neverthrow 库进行函数式错误处理，禁止使用原生 try-catch。确保错误显式传递、类型安全、调用方强制处理错误。",
    category: "backend",
    language: "typescript",
    tags: ["error-handling", "neverthrow", "result"],
  },
  {
    id: "bp_form",
    title: "表单最佳实践",
    condition: "创建或重构前端表单组件",
    content: "确保表单结构、字段验证逻辑和状态管理遵循项目表单设计规范与组件化标准。",
    category: "frontend",
    language: "typescript",
    tags: ["form", "validation", "react"],
  },
  {
    id: "bp_i18n",
    title: "国际化规范",
    condition: "创建或重构 i18n 国际化代码",
    content:
      "确保遵循 react-i18next 最佳实践（初始化配置、翻译文件结构、组件用法、SSR 同步、语言切换与测试 Mock）。",
    category: "frontend",
    language: "typescript",
    tags: ["i18n", "react-i18next", "localization"],
  },
  {
    id: "bp_one_component_per_file",
    title: "一文件一组件规范",
    condition: "检查或重构 React/Vue 组件文件",
    content: "强制每个文件只包含一个组件，不允许多组件共存于同一文件。",
    category: "frontend",
    language: "typescript",
    tags: ["react", "component", "file-structure"],
  },
  {
    id: "bp_page",
    title: "页面结构规范",
    condition: "创建或审查前端页面结构",
    content: "确保遵循 Anatomy 规范，正确分离 Wrapper、Content 和 Optional Store 模块。",
    category: "frontend",
    language: "typescript",
    tags: ["page", "architecture", "anatomy"],
  },
  {
    id: "bp_refine_trpc",
    title: "Refine tRPC 数据获取规范",
    condition: "在 React 组件中进行数据获取",
    content: "确保通过 Refine hooks 经由 DataProvider 访问数据，禁止直接调用 trpc 客户端。",
    category: "frontend",
    language: "typescript",
    tags: ["refine", "trpc", "data-provider"],
  },
  {
    id: "bp_repository",
    title: "Repository 层规范",
    condition: "创建或重构 Repository 层",
    content: "确保数据访问模式、方法命名、返回类型和接口定义符合项目规范。",
    category: "backend",
    language: "typescript",
    tags: ["repository", "data-access"],
  },
  {
    id: "bp_schema",
    title: "Schema 定义规范",
    condition: "创建或重构数据库 Schema 定义",
    content: "确保 Drizzle ORM schema 中的命名、关系和索引配置均符合规范。",
    category: "backend",
    language: "typescript",
    tags: ["schema", "drizzle", "database"],
  },
  {
    id: "bp_service",
    title: "Service 层规范",
    condition: "创建或重构 Service 层",
    content: "基于 tRPC + Service + DAO 架构确保依赖注入、错误处理和业务逻辑分层符合规范。",
    category: "backend",
    language: "typescript",
    tags: ["service", "trpc", "architecture"],
  },
  {
    id: "bp_skill",
    title: "Skill 质量验证规范",
    condition: "创建或修改 Skill 后执行质量验证",
    content: "涵盖命名、目录结构、元数据完整性、临时文件清理和依赖格式共 16 项检查。",
    category: "process",
    language: "markdown",
    tags: ["skill", "quality", "validation"],
  },
  {
    id: "bp_store",
    title: "Zustand Store 规范",
    condition: "使用 Zustand 创建或重构状态管理 Store",
    content: "确保遵循 slice 模式、Provider 设置和类型安全规范。",
    category: "frontend",
    language: "typescript",
    tags: ["zustand", "store", "state-management"],
  },
  {
    id: "bp_storybook",
    title: "Storybook 故事规范",
    condition: "创建或维护 Storybook Stories",
    content: "确保组件文档命名、参数定义和装饰器配置符合项目 Storybook 编写规范。",
    category: "frontend",
    language: "typescript",
    tags: ["storybook", "documentation", "component"],
  },
  {
    id: "bp_svg_icon",
    title: "SVG 图标规范",
    condition: "管理或新增 React TypeScript 项目中的 SVG 图标组件",
    content: "确保命名、封装方式和导出规范遵循项目标准规范。",
    category: "frontend",
    language: "typescript",
    tags: ["svg", "icon", "component"],
  },
  {
    id: "bp_ui_components",
    title: "UI 组件库使用规范",
    condition: "创建或审查 UI 组件代码",
    content: "确保在标准场景下使用项目组件库组件（如 shadcn/ui），禁止直接使用原生 HTML 元素。",
    category: "frontend",
    language: "typescript",
    tags: ["ui", "shadcn", "component-library"],
  },
  {
    id: "bp_use_store_not_props",
    title: "Store 优先于 Props 规范",
    condition: "设计组件数据流",
    content: "优先通过 Store 访问全局状态，不得通过 Props 层层传递。",
    category: "frontend",
    language: "typescript",
    tags: ["zustand", "props", "data-flow"],
  },
  {
    id: "bp_zod_infer_type",
    title: "Zod 类型派生规范",
    condition: "项目中存在 Zod schema 定义时",
    content:
      "禁止另建 type.ts 文件重复声明类型；所有类型须直接用 z.infer 从 schema 派生，杜绝类型与 schema 不同步。",
    category: "architecture",
    language: "typescript",
    tags: ["zod", "type", "schema"],
  },

  // ── Workflow-level practices (referenced by recipes) ───────────────────────
  {
    id: "bp_clean_hardcode",
    title: "代码清理规范",
    condition: "检查代码是否存在垃圾代码",
    content: "包括未使用导入、注释代码段、console.log、死代码、空函数、重复代码等。",
    category: "lint",
    language: "typescript",
    tags: ["clean-code", "hardcode", "lint"],
  },
  {
    id: "bp_classname_convention",
    title: "ClassName 转换规则",
    condition: "检查 className 是否使用模板字符串",
    content: "所有动态 className 必须使用 cn() 函数，禁止模板字符串拼接。",
    category: "frontend",
    language: "typescript",
    tags: ["classname", "cn", "tailwind"],
  },
  {
    id: "bp_full_check_workflow",
    title: "全量最佳实践检查流程",
    condition: "需要对项目进行全量最佳实践检查",
    content:
      "自动发现并依次执行所有以 best-practice 结尾的技能，输出汇总报告并强制执行标准化验证指令。",
    category: "process",
    language: "typescript",
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

  console.log(`\n🎉 Done — ${upserted} best practices upserted.`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
