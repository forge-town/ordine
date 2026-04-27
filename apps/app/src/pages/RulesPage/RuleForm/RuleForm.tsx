import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { X, Check } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
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
import type { RuleCategory, RuleSeverity } from "@repo/schemas";
import {
  CATEGORIES,
  SEVERITIES,
  CATEGORY_CONFIG,
  SEVERITY_CONFIG,
  OBJECT_TYPES,
  emptyForm,
  type RuleFormState,
  type ObjectType,
} from "../types";

export type RuleFormProps = {
  initial?: RuleFormState;
  onSave: (form: RuleFormState) => Promise<void>;
  onCancel: () => void;
};

export const RuleForm = ({ initial, onSave, onCancel }: RuleFormProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<RuleFormState>(initial ?? emptyForm());
  const [saving, setSaving] = useState(false);

  const handleCancel = () => onCancel();
  const set = (k: keyof RuleFormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => set("name", e.target.value);
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    set("description", e.target.value);
  const handleCategoryChange = (value: string | null) => {
    set("category", (value ?? form.category) as RuleCategory);
    setCategoryOpen(false);
  };
  const handleSeverityChange = (value: string | null) => {
    set("severity", (value ?? form.severity) as RuleSeverity);
    setSeverityOpen(false);
  };

  const [categoryOpen, setCategoryOpen] = useState(false);
  const handleCategoryOpenChange = (v: boolean) => setCategoryOpen(v);
  const handleCategoryToggle = () => setCategoryOpen((prev) => !prev);

  const [severityOpen, setSeverityOpen] = useState(false);
  const handleSeverityOpenChange = (v: boolean) => setSeverityOpen(v);
  const handleSeverityToggle = () => setSeverityOpen((prev) => !prev);

  const handleCheckScriptChange = (value: string) => set("checkScript", value);

  const handleToggleObjectType = (type: ObjectType) => {
    setForm((prev) => {
      const current = prev.acceptedObjectTypes;
      const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];

      return { ...prev, acceptedObjectTypes: next };
    });
  };
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => set("tags", e.target.value);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <Input
        placeholder={t("rules.namePlaceholder")}
        value={form.name}
        onChange={handleNameChange}
      />

      <Textarea
        className="resize-none"
        placeholder={t("rules.descriptionPlaceholder")}
        rows={2}
        value={form.description}
        onChange={handleDescriptionChange}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            {t("common.category")}
          </label>
          <Select
            open={categoryOpen}
            value={form.category}
            onOpenChange={handleCategoryOpenChange}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-full" onClick={handleCategoryToggle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_CONFIG[c].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            {t("rules.severity")}
          </label>
          <Select
            open={severityOpen}
            value={form.severity}
            onOpenChange={handleSeverityOpenChange}
            onValueChange={handleSeverityChange}
          >
            <SelectTrigger className="w-full" onClick={handleSeverityToggle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-muted-foreground">
          {t("rules.objectTypes")}
        </label>
        <div className="flex gap-2">
          {OBJECT_TYPES.map((type) => {
            const active = form.acceptedObjectTypes.includes(type);

            return (
              <button
                key={type}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
                type="button"
                onClick={() => handleToggleObjectType(type as ObjectType)}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] text-muted-foreground">{t("rules.checkScript")}</label>
          <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
            TypeScript
          </span>
        </div>
        <div className="overflow-hidden rounded-md border border-border text-xs">
          <CodeMirror
            extensions={[javascript({ typescript: true, jsx: true })]}
            height="200px"
            placeholder={t("rules.checkScriptPlaceholder")}
            theme={oneDark}
            value={form.checkScript}
            onChange={handleCheckScriptChange}
          />
        </div>
      </div>

      <Input
        placeholder={t("rules.tagsPlaceholder")}
        value={form.tags}
        onChange={handleTagsChange}
      />

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={handleCancel}>
          <X className="h-3.5 w-3.5" />
          {t("common.cancel")}
        </Button>
        <Button disabled={!form.name.trim() || saving} size="sm" onClick={handleSave}>
          <Check className="h-3.5 w-3.5" />
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
};
