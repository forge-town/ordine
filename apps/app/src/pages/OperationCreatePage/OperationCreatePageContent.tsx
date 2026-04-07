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
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, name: e.target.value }));
  };
  const handleCategoryChange = (value: string | null) => {
    setForm((f) => ({ ...f, category: value ?? f.category }));
  };
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, description: e.target.value }));
  };
  const handleVisibilitySelect = (v: Visibility) => {
    setForm((f) => ({ ...f, visibility: v }));
  };
  const handleObjectTypeToggle = (v: ObjectType) => {
    toggleObjectType(v);
  };
  const handleConfigChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, config: e.target.value }));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          aria-label="返回"
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">
          新建 Operation
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  名称 *
                </label>
                <Input
                  className="h-9 text-sm"
                  placeholder="e.g. Run ESLint"
                  value={form.name}
                  onChange={handleNameChange}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  分类
                </label>
                <Select
                  value={form.category}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                描述
              </label>
              <Input
                className="h-9 text-sm"
                placeholder="简单描述这个操作做什么"
                value={form.description}
                onChange={handleDescriptionChange}
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
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                      )}
                      type="button"
                      onClick={() => handleVisibilitySelect(value)}
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
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                      )}
                      type="button"
                      onClick={() => handleObjectTypeToggle(value)}
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
              <Textarea
                className="resize-none font-mono text-xs"
                placeholder='{ "command": "eslint src/" }'
                rows={5}
                value={form.config}
                onChange={handleConfigChange}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button disabled={saving || !form.name.trim()} onClick={handleSave}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
