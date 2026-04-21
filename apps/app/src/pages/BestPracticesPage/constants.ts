export const CATEGORIES = [
  { value: "all", label: "全部" },
  { value: "general", label: "通用" },
  { value: "component", label: "组件" },
  { value: "data", label: "数据层" },
  { value: "state", label: "状态管理" },
  { value: "form", label: "表单" },
  { value: "performance", label: "性能" },
  { value: "security", label: "安全" },
] as const;

export const LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "python",
  "sql",
  "bash",
  "json",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-600",
  component: "bg-violet-100 text-violet-700",
  data: "bg-blue-100 text-blue-700",
  state: "bg-amber-100 text-amber-700",
  form: "bg-pink-100 text-pink-700",
  performance: "bg-emerald-100 text-emerald-700",
  security: "bg-red-100 text-red-700",
};
