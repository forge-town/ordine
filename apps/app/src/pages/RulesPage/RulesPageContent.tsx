import { useState } from "react";
import {
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Pencil,
  Trash2,
  Tag,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { RuleEntity, RuleCategory, RuleSeverity } from "@/models/daos/rulesDao";
import { createRule, updateRule, deleteRule, toggleRule } from "@/services/rulesService";

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<RuleCategory, { label: string; cls: string }> = {
  lint: { label: "Lint", cls: "bg-gray-100 text-gray-600" },
  security: { label: "安全", cls: "bg-gray-100 text-gray-600" },
  style: { label: "风格", cls: "bg-gray-100 text-gray-600" },
  performance: { label: "性能", cls: "bg-gray-100 text-gray-600" },
  custom: { label: "自定义", cls: "bg-gray-100 text-gray-600" },
};

const SEVERITY_CONFIG: Record<
  RuleSeverity,
  { label: string; icon: React.ElementType; cls: string }
> = {
  error: {
    label: "错误",
    icon: ShieldX,
    cls: "text-red-500",
  },
  warning: {
    label: "警告",
    icon: ShieldAlert,
    cls: "text-amber-500",
  },
  info: {
    label: "提示",
    icon: ShieldCheck,
    cls: "text-gray-400",
  },
};

const CATEGORIES: RuleCategory[] = ["lint", "security", "style", "performance", "custom"];
const SEVERITIES: RuleSeverity[] = ["error", "warning", "info"];

const CATEGORY_FILTERS = [
  { value: "all" as const, label: "全部" },
  ...CATEGORIES.map((c) => ({
    value: c,
    label: CATEGORY_CONFIG[c].label,
  })),
];

// ── Form state ────────────────────────────────────────────────────────────────

interface RuleForm {
  name: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  pattern: string;
  tags: string;
}

const emptyForm = (): RuleForm => ({
  name: "",
  description: "",
  category: "custom",
  severity: "warning",
  pattern: "",
  tags: "",
});

const getEditForm = (rule: RuleEntity): RuleForm => ({
  name: rule.name,
  description: rule.description ?? "",
  category: rule.category,
  severity: rule.severity,
  pattern: rule.pattern ?? "",
  tags: rule.tags.join(", "),
});

// ── Rule card ─────────────────────────────────────────────────────────────────

const RuleCard = ({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: RuleEntity;
  onEdit: (rule: RuleEntity) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) => {
  const handleToggle = () => onToggle(rule.id, !rule.enabled);
  const handleEdit = () => onEdit(rule);
  const handleDelete = () => onDelete(rule.id);
  const s = SEVERITY_CONFIG[rule.severity];
  const c = CATEGORY_CONFIG[rule.category];
  const SeverityIcon = s.icon;

  return (
    <div
      className={cn(
        "group rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all",
        !rule.enabled && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <SeverityIcon className={cn("mt-0.5 h-4 w-4 shrink-0", s.cls)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{rule.name}</p>
            {rule.description && (
              <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{rule.description}</p>
            )}
            {rule.pattern && (
              <p className="mt-1 rounded bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-600 truncate">
                {rule.pattern}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", c.cls)}>
                {c.label}
              </span>
              {rule.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-0.5 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
            title={rule.enabled ? "禁用" : "启用"}
            onClick={handleToggle}
          >
            {rule.enabled ? (
              <ToggleRight className="h-4 w-4 text-gray-600" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-gray-400" />
            )}
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-red-50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Inline form ───────────────────────────────────────────────────────────────

const RuleForm = ({
  initial,
  onSave,
  onCancel,
}: {
  initial?: RuleForm;
  onSave: (form: RuleForm) => Promise<void>;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState<RuleForm>(initial ?? emptyForm());
  const [saving, setSaving] = useState(false);

  const set = (k: keyof RuleForm, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => set("name", e.target.value);
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    set("description", e.target.value);
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    set("category", e.target.value as RuleCategory);
  const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    set("severity", e.target.value as RuleSeverity);
  const handlePatternChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    set("pattern", e.target.value);
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => set("tags", e.target.value);
  const handleCancel = onCancel;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      {/* Name */}
      <input
        className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-gray-300"
        placeholder="规则名称 *"
        value={form.name}
        onChange={handleNameChange}
      />

      {/* Description */}
      <textarea
        className="w-full resize-none rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-gray-300"
        placeholder="规则描述（可选）"
        rows={2}
        value={form.description}
        onChange={handleDescriptionChange}
      />

      {/* Category + Severity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-gray-400">分类</label>
          <select
            className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300"
            value={form.category}
            onChange={handleCategoryChange}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_CONFIG[c].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-400">严重度</label>
          <select
            className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300"
            value={form.severity}
            onChange={handleSeverityChange}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pattern */}
      <input
        className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-sm outline-none placeholder:text-gray-400 placeholder:font-sans focus:border-gray-300"
        placeholder="规则模式（正则或关键词，可选）"
        value={form.pattern}
        onChange={handlePatternChange}
      />

      {/* Tags */}
      <input
        className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-gray-300"
        placeholder="标签（逗号分隔，可选）"
        value={form.tags}
        onChange={handleTagsChange}
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          onClick={handleCancel}
        >
          <X className="h-3.5 w-3.5" />
          取消
        </button>
        <button
          className="flex h-8 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-xs font-medium text-white disabled:opacity-50 hover:bg-gray-700 transition-colors"
          disabled={!form.name.trim() || saving}
          onClick={handleSave}
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const RulesPageContent = ({ rules: initial }: { rules: RuleEntity[] }) => {
  const [rules, setRules] = useState(initial);
  const [categoryFilter, setCategoryFilter] = useState<RuleCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (form: RuleForm) => {
    const rule = await createRule({
      data: {
        id: crypto.randomUUID(),
        name: form.name,
        description: form.description || null,
        category: form.category,
        severity: form.severity,
        pattern: form.pattern || null,
        enabled: true,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      },
    });
    setRules((prev) => [rule, ...prev]);
    setShowForm(false);
  };

  const handleUpdate = async (form: RuleForm) => {
    if (!editingId) return;
    const rule = await updateRule({
      data: {
        id: editingId,
        name: form.name,
        description: form.description || null,
        category: form.category,
        severity: form.severity,
        pattern: form.pattern || null,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      },
    });
    setRules((prev) => prev.map((r) => (r.id === editingId ? rule : r)));
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteRule({ data: { id } });
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    const rule = await toggleRule({ data: { id, enabled } });
    setRules((prev) => prev.map((r) => (r.id === id ? rule : r)));
  };

  const filtered = rules.filter((r) => {
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const enabledCount = rules.filter((r) => r.enabled).length;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);

  const handleCategoryFilterClick = (value: RuleCategory | "all") => () => setCategoryFilter(value);

  const handleShowForm = () => {
    setEditingId(null);
    setShowForm(true);
  };

  const handleHideForm = () => setShowForm(false);

  const handleEdit = (r: RuleEntity) => {
    setShowForm(false);
    setEditingId(r.id);
  };

  const handleCancelEdit = () => setEditingId(null);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-6">
        <ShieldCheck className="mr-2 h-4 w-4 text-gray-400" />
        <h1 className="text-base font-semibold text-gray-900">Rules</h1>
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {enabledCount} 启用 / {rules.length} 总计
        </span>
        <div className="ml-auto">
          <button
            className="flex h-8 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
            onClick={handleShowForm}
          >
            <Plus className="h-3.5 w-3.5" />
            新建规则
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Create form */}
        {showForm && <RuleForm onCancel={handleHideForm} onSave={handleCreate} />}

        {/* Filters + Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-gray-100 bg-white p-1 shadow-sm">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  categoryFilter === f.value
                    ? "bg-gray-100 text-gray-800"
                    : "text-gray-500 hover:text-gray-700"
                )}
                onClick={handleCategoryFilterClick(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-100 bg-white py-2 pl-9 pr-4 text-sm shadow-sm outline-none placeholder:text-gray-400 focus:border-gray-300"
              placeholder="搜索规则名称、描述或标签…"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-gray-200" />
            <p className="mt-2 text-sm text-gray-400">暂无规则</p>
            <button className="mt-2 text-xs text-gray-500 hover:underline" onClick={handleShowForm}>
              创建第一条规则
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((rule) =>
              editingId === rule.id ? (
                <div key={rule.id} className="col-span-2">
                  <RuleForm
                    initial={getEditForm(rule)}
                    onCancel={handleCancelEdit}
                    onSave={handleUpdate}
                  />
                </div>
              ) : (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
