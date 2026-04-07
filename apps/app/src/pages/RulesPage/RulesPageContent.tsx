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
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type {
  RuleEntity,
  RuleCategory,
  RuleSeverity,
} from "@/models/daos/rulesDao";
import {
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
} from "@/services/rulesService";

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<RuleCategory, { label: string; cls: string }> = {
  lint: { label: "Lint", cls: "bg-muted text-muted-foreground" },
  security: { label: "安全", cls: "bg-muted text-muted-foreground" },
  style: { label: "风格", cls: "bg-muted text-muted-foreground" },
  performance: { label: "性能", cls: "bg-muted text-muted-foreground" },
  custom: { label: "自定义", cls: "bg-muted text-muted-foreground" },
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

const CATEGORIES: RuleCategory[] = [
  "lint",
  "security",
  "style",
  "performance",
  "custom",
];
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
        "group rounded-xl border border-border bg-card p-4 transition-all",
        !rule.enabled && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <SeverityIcon className={cn("mt-0.5 h-4 w-4 shrink-0", s.cls)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {rule.name}
            </p>
            {rule.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {rule.description}
              </p>
            )}
            {rule.pattern && (
              <p className="mt-1 rounded bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground truncate">
                {rule.pattern}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  c.cls,
                )}
              >
                {c.label}
              </span>
              {rule.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-0.5 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground"
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
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-accent"
            title={rule.enabled ? "禁用" : "启用"}
            onClick={handleToggle}
          >
            {rule.enabled ? (
              <ToggleRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-accent"
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
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

  const set = (k: keyof RuleForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    set("name", e.target.value);
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    set("description", e.target.value);
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    set("category", e.target.value as RuleCategory);
  const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    set("severity", e.target.value as RuleSeverity);
  const handlePatternChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    set("pattern", e.target.value);
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    set("tags", e.target.value);
  const handleCancel = onCancel;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      {/* Name */}
      <Input
        placeholder="规则名称 *"
        value={form.name}
        onChange={handleNameChange}
      />

      {/* Description */}
      <textarea
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        placeholder="规则描述（可选）"
        rows={2}
        value={form.description}
        onChange={handleDescriptionChange}
      />

      {/* Category + Severity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            分类
          </label>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
          <label className="mb-1 block text-[11px] text-muted-foreground">
            严重度
          </label>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
      <Input
        className="font-mono"
        placeholder="规则模式（正则或关键词，可选）"
        value={form.pattern}
        onChange={handlePatternChange}
      />

      {/* Tags */}
      <Input
        placeholder="标签（逗号分隔，可选）"
        value={form.tags}
        onChange={handleTagsChange}
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={handleCancel}>
          <X className="h-3.5 w-3.5" />
          取消
        </Button>
        <Button
          disabled={!form.name.trim() || saving}
          size="sm"
          onClick={handleSave}
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

export const RulesPageContent = ({
  rules: initial,
}: {
  rules: RuleEntity[];
}) => {
  const [rules, setRules] = useState(initial);
  const [categoryFilter, setCategoryFilter] = useState<RuleCategory | "all">(
    "all",
  );
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

  const handleCategoryFilterClick = (value: RuleCategory | "all") => () =>
    setCategoryFilter(value);

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
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
        <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" />
        <h1 className="text-base font-semibold text-foreground">Rules</h1>
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {enabledCount} 启用 / {rules.length} 总计
        </span>
        <div className="ml-auto">
          <Button size="sm" onClick={handleShowForm}>
            <Plus className="h-3.5 w-3.5" />
            新建规则
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Create form */}
        {showForm && (
          <RuleForm onCancel={handleHideForm} onSave={handleCreate} />
        )}

        {/* Filters + Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  categoryFilter === f.value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={handleCategoryFilterClick(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="搜索规则名称、描述或标签…"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">暂无规则</p>
            <Button
              className="mt-2 h-auto p-0 text-xs"
              variant="link"
              onClick={handleShowForm}
            >
              创建第一条规则
            </Button>
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
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
};
