import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { z } from "zod/v4";
import type { RuleCategory, RuleSeverity, RuleRecord } from "@repo/db-schema";
import { RuleCategorySchema, RuleSeveritySchema, RuleScriptLanguageSchema } from "@repo/schemas";

export const CATEGORY_CONFIG: Record<RuleCategory, { label: string; cls: string }> = {
  lint: { label: "Lint", cls: "bg-muted text-muted-foreground" },
  security: { label: "安全", cls: "bg-muted text-muted-foreground" },
  style: { label: "风格", cls: "bg-muted text-muted-foreground" },
  performance: { label: "性能", cls: "bg-muted text-muted-foreground" },
  structure: { label: "结构", cls: "bg-muted text-muted-foreground" },
  testing: { label: "测试", cls: "bg-muted text-muted-foreground" },
  custom: { label: "自定义", cls: "bg-muted text-muted-foreground" },
};

export const SEVERITY_CONFIG: Record<
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

export const CATEGORIES: RuleCategory[] = [
  "lint",
  "security",
  "style",
  "performance",
  "structure",
  "testing",
  "custom",
];

export const SEVERITIES: RuleSeverity[] = ["error", "warning", "info"];

export const CATEGORY_FILTERS = [
  { value: "all" as const, label: "全部" },
  ...CATEGORIES.map((c) => ({
    value: c,
    label: CATEGORY_CONFIG[c].label,
  })),
];

export const OBJECT_TYPES = ["file", "folder"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const SCRIPT_LANGUAGES = ["typescript", "bash"] as const;

export const RuleFormStateSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: RuleCategorySchema,
  severity: RuleSeveritySchema,
  checkScript: z.string(),
  scriptLanguage: RuleScriptLanguageSchema,
  acceptedObjectTypes: z.array(z.enum(["file", "folder"])),
  tags: z.string(),
});

export type RuleFormState = z.infer<typeof RuleFormStateSchema>;

export const emptyForm = (): RuleFormState => ({
  name: "",
  description: "",
  category: "custom",
  severity: "warning",
  checkScript: "",
  scriptLanguage: "typescript" as const,
  acceptedObjectTypes: [] as ("file" | "folder")[],
  tags: "",
});

export const getEditForm = (rule: RuleRecord): RuleFormState => ({
  name: rule.name,
  description: rule.description ?? "",
  category: rule.category,
  severity: rule.severity,
  checkScript: rule.checkScript ?? "",
  scriptLanguage: (rule.scriptLanguage ?? "typescript") as "typescript",
  acceptedObjectTypes: (rule.acceptedObjectTypes as ("file" | "folder")[]).filter(
    (t): t is "file" | "folder" => t === "file" || t === "folder"
  ),
  tags: rule.tags.join(", "),
});
