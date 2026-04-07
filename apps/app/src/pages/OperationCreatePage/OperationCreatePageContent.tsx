import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileCode,
  Folder,
  FolderGit2,
  Globe,
  Lock,
  Users,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { createOperation } from "@/services/operationsService";
import type { ObjectType, Visibility } from "@/models/tables/operations_table";

const CATEGORIES = [
  "general",
  "lint",
  "format",
  "build",
  "test",
  "deploy",
  "custom",
] as const;

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "public", label: "公开", icon: Globe },
  { value: "team", label: "团队", icon: Users },
  { value: "private", label: "私有", icon: Lock },
];

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

export const OperationCreatePageContent = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleCancel = () => {
    navigate({ to: "/operations" });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
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
        navigate({
          to: "/operations/$operationId",
          params: { operationId: (created as { id: string }).id },
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleObjectType = (type: ObjectType) => {
    setForm((prev) => {
      const current = prev.acceptedObjectTypes;
      if (current.includes(type)) {
        if (current.length === 1) return prev;
        return {
          ...prev,
          acceptedObjectTypes: current.filter((t) => t !== type),
        };
      }
      return { ...prev, acceptedObjectTypes: [...current, type] };
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <h1 className="text-lg font-semibold">新建 Operation</h1>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                名称 *
              </label>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. Run ESLint"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                分类
              </label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
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
            <label className="text-xs font-medium text-muted-foreground">
              描述
            </label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="简单描述这个操作做什么"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              可见性
            </label>
            <div className="flex gap-2">
              {VISIBILITY_OPTIONS.map(({ value, label, icon: Icon }) => {
                const selected = form.visibility === value;
                return (
                  <button
                    key={value}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      selected
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
                    )}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, visibility: value }))
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {selected && <span className="ml-1 text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

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
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      selected
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
                    )}
                    type="button"
                    onClick={() => toggleObjectType(value)}
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
            <label className="text-xs font-medium text-muted-foreground">
              配置 (JSON)
            </label>
            <textarea
              className="w-full resize-none rounded-md border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder='{ "command": "eslint src/" }'
              rows={5}
              value={form.config}
              onChange={(e) =>
                setForm((f) => ({ ...f, config: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-lg border px-4 py-2 text-sm hover:bg-accent"
            onClick={handleCancel}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            disabled={saving || !form.name.trim()}
            onClick={handleSave}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
};
