import { useState } from "react";
import { Search, Wand2, ExternalLink } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";

type SkillCategory =
  | "all"
  | "page"
  | "data"
  | "state"
  | "form"
  | "code-quality";

interface Skill {
  name: string;
  label: string;
  description: string;
  category: Exclude<SkillCategory, "all">;
  tags: string[];
}

const skills: Skill[] = [
  {
    name: "page-best-practice",
    label: "页面结构",
    description:
      "生成标准的页面 Anatomy：Wrapper + Content + 可选 Store，确保页面结构清晰分层。",
    category: "page",
    tags: ["React", "Anatomy", "Layout"],
  },
  {
    name: "store-best-practice",
    label: "状态管理 Store",
    description:
      "基于 Zustand slice 模式创建 Store，包含 Context Provider 和类型安全的 hook。",
    category: "state",
    tags: ["Zustand", "Slice", "Context"],
  },
  {
    name: "dao-best-practice",
    label: "DAO 层",
    description:
      "使用 Drizzle ORM 规范创建数据访问对象，确保命名、类型安全和查询性能。",
    category: "data",
    tags: ["Drizzle", "ORM", "Database"],
  },
  {
    name: "service-best-practice",
    label: "Service 层",
    description:
      "按照 tRPC + Service + DAO 架构创建 Service，分离业务逻辑与数据访问。",
    category: "data",
    tags: ["tRPC", "Service", "Architecture"],
  },
  {
    name: "form-best-practice",
    label: "表单组件",
    description: "创建符合规范的表单组件，包含字段验证、状态管理和 UI 结构。",
    category: "form",
    tags: ["Form", "Validation", "UX"],
  },
  {
    name: "schema-best-practice",
    label: "Schema 校验",
    description:
      "使用 Drizzle ORM schema 定义数据库表，确保命名、关系和索引配置规范。",
    category: "data",
    tags: ["Schema", "Drizzle", "Types"],
  },
  {
    name: "barrel-export-best-practice",
    label: "桶导出规范",
    description:
      "生成和检查 index.ts 桶导出文件，确保所有 index 文件仅做 re-export。",
    category: "code-quality",
    tags: ["Exports", "Index", "Module"],
  },
  {
    name: "error-handling-best-practice",
    label: "错误处理",
    description:
      "规范化 try-catch 写法，确保 catch 块有实质处理逻辑，不为空或仅记录日志。",
    category: "code-quality",
    tags: ["Error", "Try-Catch", "Safety"],
  },
  {
    name: "db-table-best-practice",
    label: "数据库表命名",
    description: "验证和修正数据库表定义的命名规范，包括表名、列名和索引。",
    category: "data",
    tags: ["Database", "Naming", "Schema"],
  },
  {
    name: "svg-icon-best-practice",
    label: "SVG 图标规范",
    description:
      "管理 React TypeScript 项目中的 SVG 图标，确保命名、封装和导出规范。",
    category: "code-quality",
    tags: ["SVG", "Icons", "Components"],
  },
  {
    name: "one-component-per-file-best-practice",
    label: "单组件单文件",
    description: "强制每个文件只包含一个 React/Vue 组件，不允许多组件共存。",
    category: "code-quality",
    tags: ["Components", "Structure", "React"],
  },
  {
    name: "refine-trpc-best-practice",
    label: "Refine tRPC 规范",
    description:
      "在 React 组件中通过 Refine hooks 经由 DataProvider 访问数据，禁止直接调用 tRPC。",
    category: "data",
    tags: ["Refine", "tRPC", "DataProvider"],
  },
];

const categoryLabels: Record<SkillCategory, string> = {
  all: "全部",
  page: "页面结构",
  data: "数据层",
  state: "状态管理",
  form: "表单",
  "code-quality": "代码质量",
};

const categoryColors: Record<Exclude<SkillCategory, "all">, string> = {
  page: "bg-violet-100 text-violet-700",
  data: "bg-blue-100 text-blue-700",
  state: "bg-emerald-100 text-emerald-700",
  form: "bg-amber-100 text-amber-700",
  "code-quality": "bg-gray-100 text-gray-600",
};

export const SkillsPageContent = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SkillCategory>("all");

  const filtered = skills.filter((s) => {
    const matchesSearch =
      s.label.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || s.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">技能库</h1>
          <p className="text-xs text-muted-foreground">
            {skills.length} 个可用 Skill
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索技能..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(categoryLabels) as SkillCategory[]).map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? "default" : "ghost"}
              size="sm"
              onClick={() => setCategory(cat)}
              className="text-xs h-7 px-2.5"
            >
              {categoryLabels[cat]}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
            <Wand2 className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm">未找到匹配的 Skill</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((skill) => (
              <div
                key={skill.name}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Wand2 className="h-4 w-4 text-primary" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px]",
                      categoryColors[skill.category],
                    )}
                  >
                    {categoryLabels[skill.category]}
                  </Badge>
                </div>

                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  {skill.label}
                </h3>
                <p className="mt-1 flex-1 text-xs text-muted-foreground leading-relaxed">
                  {skill.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {skill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <code className="text-[10px] text-muted-foreground">
                    {skill.name}
                  </code>
                  <button className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 hover:text-primary/80 transition-opacity">
                    <ExternalLink className="h-3 w-3" />
                    详情
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
