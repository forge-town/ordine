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
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {initial ? "编辑最佳实践" : "新增最佳实践"}
          </h2>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <form
          onSubmit={handleFormSubmit}
          className="p-5 space-y-4 overflow-y-auto"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              标题 *
            </label>
            <input
              value={form.title}
              onChange={handleTitleChange}
              placeholder="e.g. 避免在 useEffect 中直接 setState"
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              适用时机 (Condition) *
            </label>
            <textarea
              value={form.condition}
              onChange={handleConditionChange}
              placeholder="描述什么情况下应该遵循这个实践，例如：当需要在组件挂载后获取异步数据时..."
              required
              rows={3}
              className={cn(inputCls, "resize-none")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                分类
              </label>
              <select
                value={form.category}
                onChange={handleCategoryChange}
                className={inputCls}
              >
                {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                语言
              </label>
              <select
                value={form.language}
                onChange={handleLanguageChange}
                className={inputCls}
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
            <label className="mb-1 block text-xs font-medium text-gray-600">
              代码片段
            </label>
            <textarea
              value={form.codeSnippet}
              onChange={handleCodeSnippetChange}
              placeholder="// 在这里粘贴代码示例..."
              rows={8}
              spellCheck={false}
              className={cn(
                inputCls,
                "resize-y font-mono text-xs leading-relaxed",
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              标签 (逗号分隔)
            </label>
            <input
              value={form.tags}
              onChange={handleTagsChange}
              placeholder="react, hooks, async"
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !form.title || !form.condition}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
    <div className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-violet-200 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50">
          <BookOpen className="h-4 w-4 text-violet-600" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">
              {practice.title}
            </h3>
            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleEdit}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100"
              >
                <Pencil className="h-3.5 w-3.5 text-gray-400" />
              </button>
              <button
                onClick={handleDelete}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-50"
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
                  "bg-gray-100 text-gray-600",
              )}
            >
              {CATEGORIES.find((c) => c.value === practice.category)?.label ??
                practice.category}
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 font-mono">
              {practice.language}
            </span>
            {practice.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Condition */}
      <div className="border-t border-gray-50 bg-amber-50/60 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-1">
          适用时机
        </p>
        <p className="text-xs text-gray-700 leading-relaxed">
          {practice.condition}
        </p>
      </div>

      {/* Code snippet toggle */}
      {hasCode && (
        <div className="border-t border-gray-100">
          <button
            onClick={handleToggleExpanded}
            className="flex w-full items-center gap-2 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Code2 className="h-3.5 w-3.5 text-gray-400" />
            <span className="flex-1 text-left font-medium">代码片段</span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {expanded && (
            <div className="border-t border-gray-100 bg-gray-950 px-4 py-3 overflow-x-auto">
              <pre className="text-xs leading-relaxed text-gray-100 font-mono whitespace-pre">
                {practice.codeSnippet}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

  const handleCategoryClick =
    (catValue: string) =>
    () =>
      setActiveCategory(catValue);

  const handleAddPractice = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEditPractice =
    (p: BestPracticeEntity) =>
    () => {
      setEditing(p);
      setShowForm(true);
    };

  const handleDeletePractice =
    (id: string) =>
    () =>
      void handleDelete(id);

  const handleFormClose = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <h1 className="text-base font-semibold text-gray-900">最佳实践</h1>
        <button
          onClick={handleAddPractice}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          新增实践
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索实践、标签..."
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={handleCategoryClick(cat.value)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activeCategory === cat.value
                  ? "bg-violet-600 text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
              )}
            >
              {cat.label}
              {cat.value !== "all" && (
                <span className="ml-1 text-[10px] opacity-70">
                  {practices.filter((p) => p.category === cat.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} 条
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <BookOpen className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-gray-700">
              {search || activeCategory !== "all"
                ? "未找到匹配的实践"
                : "还没有最佳实践"}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              {search || activeCategory !== "all"
                ? "尝试其他关键词或分类"
                : "记录第一条最佳实践来开始"}
            </p>
            {!search && activeCategory === "all" && (
              <button
                onClick={handleAddPractice}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                新增实践
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-4xl">
            {filtered.map((p) => (
              <PracticeCard
                key={p.id}
                practice={p}
                onEdit={handleEditPractice(p)}
                onDelete={handleDeletePractice(p.id)}
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
