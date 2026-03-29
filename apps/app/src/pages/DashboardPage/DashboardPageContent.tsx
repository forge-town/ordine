import { Link } from "@tanstack/react-router";
import {
  Workflow,
  FolderOpen,
  BookOpen,
  Sparkles,
  ArrowRight,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui/card";
import { Button, buttonVariants } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";

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
  },
  {
    icon: FolderOpen,
    title: "查看项目",
    description: "管理和浏览你的所有项目",
    to: "/projects",
  },
  {
    icon: BookOpen,
    title: "浏览技能库",
    description: "查看所有可用的 Skill 和最佳实践",
    to: "/skills",
  },
  {
    icon: Sparkles,
    title: "AI 助手",
    description: "与 Ordine AI 讨论你的 Pipeline 设计",
    to: "/assistant",
  },
];

export const DashboardPageContent = () => {
  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Header */}
      <div className="border-b bg-background px-8 py-5">
        <h1 className="text-xl font-bold">仪表盘</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          欢迎使用 Ordine — AI 驱动的 Skill Pipeline 设计平台
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="py-4 gap-1">
              <CardHeader className="px-4 pb-0 pt-0">
                <CardDescription className="text-xs">{s.label}</CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 text-sm font-semibold">快速开始</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link to={a.to as "/"} key={a.to}>
                  <Card className="cursor-pointer py-4 transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center gap-4 px-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Recent pipelines placeholder */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">最近 Pipeline</h2>
            <Link
              to="/canvas"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <Plus className="h-3 w-3" />
              新建
            </Link>
          </div>
          <div className="rounded-xl border border-dashed py-12 text-center">
            <Workflow className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              还没有 Pipeline
            </p>
            <Link
              to="/canvas"
              className={buttonVariants({ className: "mt-3" })}
            >
              <Plus />在 Canvas 上创建
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
