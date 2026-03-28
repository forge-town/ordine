import { Link } from "@tanstack/react-router";
import {
  Workflow,
  FolderOpen,
  BookOpen,
  Sparkles,
  ArrowRight,
  Plus,
} from "lucide-react";

const stats = [
  { label: "Pipeline 总数", value: "0", sub: "尚无 pipeline" },
  { label: "已运行 Skill", value: "0", sub: "本周" },
  { label: "通过验收", value: "—", sub: "验收条件" },
  { label: "未解决问题", value: "0", sub: "需要处理" },
];

const quickActions = [
  {
    icon: Workflow,
    title: "新建 Pipeline",
    description: "在 Canvas 上设计一条新的 Skill 流水线",
    to: "/canvas",
    color: "bg-violet-50 border-violet-200 hover:border-violet-400",
    iconBg: "bg-violet-500",
  },
  {
    icon: FolderOpen,
    title: "查看项目",
    description: "管理和浏览你的所有项目",
    to: "/projects",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    iconBg: "bg-blue-500",
  },
  {
    icon: BookOpen,
    title: "浏览技能库",
    description: "查看所有可用的 Skill 和最佳实践",
    to: "/skills",
    color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
    iconBg: "bg-emerald-500",
  },
  {
    icon: Sparkles,
    title: "AI 助手",
    description: "与 Ordine AI 讨论你的 Pipeline 设计",
    to: "/assistant",
    color: "bg-amber-50 border-amber-200 hover:border-amber-400",
    iconBg: "bg-amber-500",
  },
];

export const DashboardPageContent = () => {
  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-8 py-5">
        <h1 className="text-xl font-bold text-gray-900">仪表盘</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          欢迎使用 Ordine — AI 驱动的 Skill Pipeline 设计平台
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs"
            >
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">快速开始</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.to}
                  to={a.to as "/"}
                  className={[
                    "flex items-center gap-4 rounded-xl border p-4 transition-colors group",
                    a.color,
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      a.iconBg,
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">
                      {a.title}
                    </p>
                    <p className="text-xs text-gray-500">{a.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent pipelines placeholder */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              最近 Pipeline
            </h2>
            <Link
              to="/canvas"
              className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
            >
              <Plus className="h-3 w-3" />
              新建
            </Link>
          </div>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
            <Workflow className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-400">还没有 Pipeline</p>
            <Link
              to="/canvas"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
            >
              <Plus className="h-4 w-4" />在 Canvas 上创建
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
