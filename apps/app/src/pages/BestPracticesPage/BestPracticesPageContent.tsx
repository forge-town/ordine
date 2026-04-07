import { useState } from "react";
import {
  Plus,
  Search,
  X,
  BookOpen,
  Code2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Tag,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import {
  createBestPractice,
  updateBestPractice,
  deleteBestPractice,
} from "@/services/bestPracticesService";

// ── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "all", label: "全部" },
  { value: "general", label: "通用" },
  { value: "component", label: "组件" },
  { value: "data", label: "数据层" },
  { value: "state", label: "状态管理" },
  { value: "form", label: "表单" },
  { value: "performance", label: "性能" },
  { value: "security", label: "安全" },
] as const;

const LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "python",
  "sql",
  "bash",
  "json",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-600",
  component: "bg-violet-100 text-violet-700",
  data: "bg-blue-100 text-blue-700",
  state: "bg-amber-100 text-amber-700",
  form: "bg-pink-100 text-pink-700",
  performance: "bg-emerald-100 text-emerald-700",
  security: "bg-red-100 text-red-700",
};

// ── Form dialog ───────────────────────────────────────────────────────────────

type FormState = {
  title: string;
  condition: string;
  category: string;
  language: string;
  codeSnippet: string;
  tags: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  condition: "",
  category: "general",
  language: "typescript",
  codeSnippet: "",
  tags: "",
};

const PracticeFormDialog = ({
  initial,
  onClose,
  onSave,
}: {
  initial?: BestPracticeEntity;
  onClose: () => void;
  onSave: (p: BestPracticeEntity) => void;
}) => {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          title: initial.title,
          condition: initial.condition,
          category: initial.category,
          language: initial.language,
          codeSnippet: initial.codeSnippet,
          tags: initial.tags.join(", "),
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);

  const set =
    (k: keyof FormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleTitleChange = set("title");
  const handleConditionChange = set("condition");
  const handleCategoryChange = set("category");
  const handleLanguageChange = set("language");
  const handleCodeSnippetChange = set("codeSnippet");
  const handleTagsChange = set("tags");
  const handleClose = onClose;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.condition.trim()) return;
    setSaving(true);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (initial) {
        const updated = await updateBestPractice({
          data: {
            id: initial.id,
            patch: { ...form, tags },
          },
        });
        if (updated) onSave(updated);
      } else {
        const created = await createBestPractice({
          data: {
            id: `bp-${Date.now()}`,
            title: form.title.trim(),
            condition: form.condition.trim(),
            category: form.category,
            language: form.language,
            codeSnippet: form.codeSnippet,
            tags,
          },
        });
        onSave(created);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => void handleSubmit(e);

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            {initial ? "编辑最佳实践" : "新增最佳实践"}
          </h2>
          <Button
            className="h-7 w-7"
            size="icon"
            variant="ghost"
            onClick={handleClose}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <form
          className="p-5 space-y-4 overflow-y-auto"
          onSubmit={handleFormSubmit}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              标题 *
            </label>
            <Input
              required
              placeholder="e.g. 避免在 useEffect 中直接 setState"
              value={form.title}
              onChange={handleTitleChange}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              适用时机 (Condition) *
            </label>
            <textarea
              required
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="描述什么情况下应该遵循这个实践，例如：当需要在组件挂载后获取异步数据时..."
              rows={3}
              value={form.condition}
              onChange={handleConditionChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                分类
              </label>
              <select
                className={inputCls}
                value={form.category}
                onChange={handleCategoryChange}
              >
                {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                语言
              </label>
              <select
                className={inputCls}
                value={form.language}
                onChange={handleLanguageChange}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              代码片段
            </label>
            <textarea
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="// 在这里粘贴代码示例..."
              rows={8}
              spellCheck={false}
              value={form.codeSnippet}
              onChange={handleCodeSnippetChange}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              标签 (逗号分隔)
            </label>
            <Input
              placeholder="react, hooks, async"
              value={form.tags}
              onChange={handleTagsChange}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 shrink-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              disabled={saving || !form.title || !form.condition}
              type="submit"
            >
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Practice card ─────────────────────────────────────────────────────────────

const PracticeCard = ({
  practice,
  onEdit,
  onDelete,
}: {
  practice: BestPracticeEntity;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasCode = practice.codeSnippet.trim().length > 0;
  const handleToggleExpanded = () => setExpanded((v) => !v);
  const handleEdit = onEdit;
  const handleDelete = onDelete;

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground leading-snug">
              {practice.title}
            </h3>
            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                onClick={handleEdit}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          </div>

          {/* Category badge */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                CATEGORY_COLORS[practice.category] ??
                  "bg-muted text-muted-foreground",
              )}
            >
              {CATEGORIES.find((c) => c.value === practice.category)?.label ??
                practice.category}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-mono">
              {practice.language}
            </span>
            {practice.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Condition */}
      <div className="border-t border-border bg-amber-50/60 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-1">
          适用时机
        </p>
        <p className="text-xs text-foreground leading-relaxed">
          {practice.condition}
        </p>
      </div>

      {/* Code snippet toggle */}
      {hasCode && (
        <div className="border-t border-border">
          <button
            className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
            onClick={handleToggleExpanded}
          >
            <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-left font-medium">代码片段</span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {expanded && (
            <div className="border-t border-border bg-gray-950 px-4 py-3 overflow-x-auto">
              <pre className="text-xs leading-relaxed text-gray-100 font-mono whitespace-pre">
                {practice.codeSnippet}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main page content ─────────────────────────────────────────────────────────

export const BestPracticesPageContent = ({
  practices: initialPractices,
}: {
  practices: BestPracticeEntity[];
}) => {
  const [practices, setPractices] =
    useState<BestPracticeEntity[]>(initialPractices);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BestPracticeEntity | null>(null);

  const filtered = practices.filter((p) => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.condition.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const handleSave = (p: BestPracticeEntity) => {
    setPractices((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = p;
        return next;
      }
      return [p, ...prev];
    });
  };

  const handleDelete = async (id: string) => {
    setPractices((prev) => prev.filter((p) => p.id !== id));
    await deleteBestPractice({ data: { id } });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

  const handleCategoryClick = (catValue: string) => () =>
    setActiveCategory(catValue);

  const handleAddPractice = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEditPractice = (p: BestPracticeEntity) => () => {
    setEditing(p);
    setShowForm(true);
  };

  const handleDeletePractice = (id: string) => () => void handleDelete(id);

  const handleFormClose = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">最佳实践</h1>
        <Button size="sm" onClick={handleAddPractice}>
          <Plus className="h-4 w-4" />
          新增实践
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="搜索实践、标签..."
            type="text"
            value={search}
            onChange={handleSearchChange}
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              className="h-7 whitespace-nowrap px-3 text-xs"
              size="sm"
              variant={activeCategory === cat.value ? "default" : "ghost"}
              onClick={handleCategoryClick(cat.value)}
            >
              {cat.label}
              {cat.value !== "all" && (
                <span className="ml-1 text-[10px] opacity-70">
                  {practices.filter((p) => p.category === cat.value).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} 条
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {search || activeCategory !== "all"
                ? "未找到匹配的实践"
                : "还没有最佳实践"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || activeCategory !== "all"
                ? "尝试其他关键词或分类"
                : "记录第一条最佳实践来开始"}
            </p>
            {!search && activeCategory === "all" && (
              <Button className="mt-4" onClick={handleAddPractice}>
                <Plus className="h-4 w-4" />
                新增实践
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-4xl">
            {filtered.map((p) => (
              <PracticeCard
                key={p.id}
                practice={p}
                onDelete={handleDeletePractice(p.id)}
                onEdit={handleEditPractice(p)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <PracticeFormDialog
          initial={editing ?? undefined}
          onClose={handleFormClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
};
