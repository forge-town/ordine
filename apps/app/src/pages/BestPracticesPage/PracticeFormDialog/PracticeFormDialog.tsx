import { useState } from "react";
import { X } from "lucide-react";
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
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import { createBestPractice, updateBestPractice } from "@/services/bestPracticesService";
import { CATEGORIES, LANGUAGES } from "../constants";

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

export type PracticeFormDialogProps = {
  initial?: BestPracticeEntity;
  onClose: () => void;
  onSave: (p: BestPracticeEntity) => void;
};

export const PracticeFormDialog = ({ initial, onClose, onSave }: PracticeFormDialogProps) => {
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
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  const set =
    (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleTitleChange = set("title");
  const handleConditionChange = set("condition");
  const handleCategoryChange = (value: string | null) =>
    setForm((prev) => ({ ...prev, category: value ?? prev.category }));
  const handleLanguageChange = (value: string | null) =>
    setForm((prev) => ({ ...prev, language: value ?? prev.language }));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            {initial ? "编辑最佳实践" : "新增最佳实践"}
          </h2>
          <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <form className="p-5 space-y-4 overflow-y-auto" onSubmit={handleFormSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">标题 *</label>
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
            <Textarea
              required
              className="resize-none"
              placeholder="描述什么情况下应该遵循这个实践，例如：当需要在组件挂载后获取异步数据时..."
              rows={3}
              value={form.condition}
              onChange={handleConditionChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">分类</label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">语言</label>
              <Select value={form.language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">代码片段</label>
            <Textarea
              className="resize-y font-mono text-xs leading-relaxed"
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
            <Button disabled={saving || !form.title || !form.condition} type="submit">
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
