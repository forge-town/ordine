import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Pencil,
  Trash2,
  Zap,
  FileCode,
  Folder,
  FolderGit2,
  ExternalLink,
  Globe,
  Lock,
  Users,
} from "lucide-react";
import { createOperation, updateOperation, deleteOperation } from "@/services/operationsService";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { ObjectType, Visibility } from "@/models/tables/operations_table";
import { cn } from "@repo/ui/lib/utils";

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "public", label: "公开", icon: Globe },
  { value: "team", label: "团队", icon: Users },
  { value: "private", label: "私有", icon: Lock },
];

const VISIBILITY_COLORS: Record<Visibility, string> = {
  public: "bg-emerald-50 text-emerald-700",
  team: "bg-sky-50 text-sky-700",
  private: "bg-rose-50 text-rose-700",
};

interface Props {
  initialOperations: OperationEntity[];
}

const CATEGORIES = ["general", "lint", "format", "build", "test", "deploy", "custom"] as const;

const OBJECT_TYPE_OPTIONS: {
  value: ObjectType;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "file", label: "文件", icon: FileCode },
  { value: "folder", label: "文件夹", icon: Folder },
  { value: "project", label: "整个项目", icon: FolderGit2 },
];

interface FormState {
  name: string;
  description: string;
  category: string;
  visibility: Visibility;
  config: string;
  acceptedObjectTypes: ObjectType[];
}

const emptyForm: FormState = {
  name: "",
  description: "",
  category: "general",
  visibility: "public",
  config: "{}",
  acceptedObjectTypes: ["file", "folder", "project"],
};

export const OperationsPageContent = ({ initialOperations }: Props) => {
  type SortKey = "default" | "name-asc" | "name-desc" | "date-asc" | "date-desc" | "category-asc";

  const [operations, setOperations] = useState(initialOperations);
  const [visibilityFilter, setVisibilityFilter] = useState<Visibility | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const filteredOperations = operations
    .filter((op) => visibilityFilter === "all" || (op.visibility ?? "public") === visibilityFilter)
    .filter((op) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return op.name.toLowerCase().includes(q) || (op.description ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc": {
          return a.name.localeCompare(b.name);
        }
        case "name-desc": {
          return b.name.localeCompare(a.name);
        }
        case "date-asc": {
          return a.createdAt - b.createdAt;
        }
        case "date-desc": {
          return b.createdAt - a.createdAt;
        }
        case "category-asc": {
          return a.category.localeCompare(b.category);
        }
        default: {
          return 0;
        }
      }
    });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (op: OperationEntity) => {
    setEditingId(op.id);
    setForm({
      name: op.name,
      description: op.description ?? "",
      category: op.category,
      visibility: op.visibility ?? "public",
      config: op.config,
      acceptedObjectTypes: Array.isArray(op.acceptedObjectTypes)
        ? op.acceptedObjectTypes
        : ["file", "folder", "project"],
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const toggleObjectType = (type: ObjectType) => {
    setForm((prev) => {
      const current = prev.acceptedObjectTypes;
      if (current.includes(type)) {
        // Don't allow unchecking the last option
        if (current.length === 1) return prev;
        return {
          ...prev,
          acceptedObjectTypes: current.filter((t) => t !== type),
        };
      }
      return { ...prev, acceptedObjectTypes: [...current, type] };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateOperation({
          data: {
            id: editingId,
            name: form.name,
            description: form.description || null,
            category: form.category,
            visibility: form.visibility,
            config: form.config,
            acceptedObjectTypes: form.acceptedObjectTypes,
          },
        });
        if (updated) {
          setOperations((prev) =>
            prev.map((o) => (o.id === editingId ? (updated as OperationEntity) : o))
          );
        }
      } else {
        const created = await createOperation({
          data: {
            id: `op-${Date.now()}`,
            name: form.name,
            description: form.description || null,
            category: form.category,
            visibility: form.visibility,
            config: form.config,
            acceptedObjectTypes: form.acceptedObjectTypes,
          },
        });
        if (created) {
          setOperations((prev) => [created as OperationEntity, ...prev]);
        }
      }
      handleCancel();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteOperation({ data: { id } });
    setOperations((prev) => prev.filter((o) => o.id !== id));
  };

  const handleVisibilityFilterClick = (value: Visibility | "all") => () =>
    setVisibilityFilter(value);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearchQuery(e.target.value);

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSortBy(e.target.value as SortKey);

  const handleOpenCreate = () => openCreate();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, name: e.target.value }));

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((f) => ({ ...f, category: e.target.value }));

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, description: e.target.value }));

  const handleVisibilityChange = (value: Visibility) => () =>
    setForm((f) => ({ ...f, visibility: value }));

  const handleToggleObjectTypeClick = (type: ObjectType) => () => toggleObjectType(type);

  const handleConfigChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, config: e.target.value }));

  const handleEditClick = (op: OperationEntity) => () => openEdit(op);

  const handleDeleteClick = (id: string) => () => void handleDelete(id);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Operations</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            定义可在 Pipeline 中复用的自定义操作
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          新建 Operation
        </button>
      </div>

      {/* Search + Visibility filter bar */}
      <div className="flex items-center gap-1.5 border-b px-6 py-2">
        {(
          [
            { value: "all" as const, label: "全部" },
            { value: "public" as const, label: "公开" },
            { value: "team" as const, label: "团队" },
            { value: "private" as const, label: "私有" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={handleVisibilityFilterClick(value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              visibilityFilter === value
                ? "bg-violet-100 text-violet-700"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="搜索操作名称或描述..."
            className="rounded-md border bg-background px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <label htmlFor="sort-select" className="sr-only">
            排序
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={handleSortChange}
            className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="排序"
          >
            <option value="default">默认顺序</option>
            <option value="name-asc">名称 A → Z</option>
            <option value="name-desc">名称 Z → A</option>
            <option value="date-desc">最新先</option>
            <option value="date-asc">最旧先</option>
            <option value="category-asc">分类 A → Z</option>
          </select>
          <span className="text-xs text-muted-foreground">{filteredOperations.length} 个</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Create / Edit form */}
        {showForm && (
          <div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">
              {editingId ? "编辑 Operation" : "新建 Operation"}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">名称 *</label>
                  <input
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.name}
                    onChange={handleNameChange}
                    placeholder="e.g. Run ESLint"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">分类</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.category}
                    onChange={handleCategoryChange}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">描述</label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.description}
                  onChange={handleDescriptionChange}
                  placeholder="简单描述这个操作做什么"
                />
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">可见性</label>
                <div className="flex gap-2">
                  {VISIBILITY_OPTIONS.map(({ value, label, icon: Icon }) => {
                    const selected = form.visibility === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={handleVisibilityChange(value)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                          selected
                            ? "border-violet-300 bg-violet-50 text-violet-700"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                        {selected && <span className="ml-1 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accepted Object Types */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  可应用的对象类型
                </label>
                <div className="flex gap-2">
                  {OBJECT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                    const selected = form.acceptedObjectTypes.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={handleToggleObjectTypeClick(value)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                          selected
                            ? "border-violet-300 bg-violet-50 text-violet-700"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                        {selected && <span className="ml-1 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">配置 (JSON)</label>
                <textarea
                  rows={4}
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.config}
                  onChange={handleConfigChange}
                  placeholder='{ "command": "eslint src/" }'
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* Operation list */}
        {filteredOperations.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            {searchQuery.trim() || visibilityFilter !== "all" ? (
              <p className="text-sm font-medium text-muted-foreground">没有找到匹配的 Operations</p>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">还没有 Operations</p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  点击「新建 Operation」添加第一个操作
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOperations.map((op) => (
              <div
                key={op.id}
                className="group relative rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                      <Zap className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{op.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {op.category}
                        </span>
                        {(() => {
                          const vCfg = VISIBILITY_OPTIONS.find(
                            (v) => v.value === (op.visibility ?? "public")
                          );
                          if (!vCfg) return null;
                          const VIcon = vCfg.icon;
                          return (
                            <span
                              className={cn(
                                "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                VISIBILITY_COLORS[vCfg.value]
                              )}
                            >
                              <VIcon className="h-2.5 w-2.5" />
                              {vCfg.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      to="/operations/$operationId"
                      params={{ operationId: op.id }}
                      className="rounded p-1 hover:bg-accent"
                      title="查看详情"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                    <button
                      onClick={handleEditClick(op)}
                      className="rounded p-1 hover:bg-accent"
                      title="编辑"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={handleDeleteClick(op.id)}
                      className="rounded p-1 hover:bg-destructive/10"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                {op.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {op.description}
                  </p>
                )}
                {/* Show accepted object types */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">适用于:</span>
                  <div className="flex gap-1">
                    {(Array.isArray(op.acceptedObjectTypes)
                      ? op.acceptedObjectTypes
                      : ["file", "folder", "project"]
                    ).map((type) => {
                      const config = OBJECT_TYPE_OPTIONS.find((o) => o.value === type);
                      if (!config) return null;
                      const Icon = config.icon;
                      return (
                        <span
                          key={type}
                          className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                          title={config.label}
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
