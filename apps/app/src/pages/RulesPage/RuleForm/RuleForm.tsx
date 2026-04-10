import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Check } from "lucide-react";
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
import type { RuleCategory, RuleSeverity } from "@/models/daos/rulesDao";
import {
  CATEGORIES,
  SEVERITIES,
  CATEGORY_CONFIG,
  SEVERITY_CONFIG,
  emptyForm,
  type RuleFormState,
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

  const set = (k: keyof RuleFormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    set("name", e.target.value);
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

      <Input
        className="font-mono"
        placeholder={t("rules.patternPlaceholder")}
        value={form.pattern}
        onChange={handlePatternChange}
      />

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
        <Button
          disabled={!form.name.trim() || saving}
          size="sm"
          onClick={handleSave}
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
};
