import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type {
  RuleCategory,
  RuleSeverity,
  RuleEntity,
} from "@/models/daos/rulesDao";

export const CATEGORY_CONFIG: Record<
  RuleCategory,
  { label: string; cls: string }
> = {
  lint: { label: "Lint", cls: "bg-muted text-muted-foreground" },
  security: { label: "安全", cls: "bg-muted text-muted-foreground" },
  style: { label: "风格", cls: "bg-muted text-muted-foreground" },
  performance: { label: "性能", cls: "bg-muted text-muted-foreground" },
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

export interface RuleFormState {
  name: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  pattern: string;
  tags: string;
}

export const emptyForm = (): RuleFormState => ({
  name: "",
  description: "",
  category: "custom",
  severity: "warning",
  pattern: "",
  tags: "",
});

export const getEditForm = (rule: RuleEntity): RuleFormState => ({
  name: rule.name,
  description: rule.description ?? "",
  category: rule.category,
  severity: rule.severity,
  pattern: rule.pattern ?? "",
  tags: rule.tags.join(", "),
});
