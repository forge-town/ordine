import { useNavigate } from "@tanstack/react-router";
import { MetaRow } from "../MetaRow";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  Terminal,
  Info,
  Cpu,
  Code2,
  FileSearch,
  Wand2,
  Layers,
  Link2,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import type { JobEntity } from "@/models/daos/jobsDao";
import type { JobStatus, JobType } from "@/models/tables/jobs_table";

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; icon: React.ElementType; cls: string; bar: string }
> = {
  queued: {
    label: "排队中",
    icon: Clock,
    cls: "bg-gray-100 text-gray-700",
    bar: "bg-gray-300",
  },
  running: {
    label: "运行中",
    icon: Loader2,
    cls: "bg-blue-50 text-blue-700",
    bar: "bg-blue-500",
  },
  done: {
    label: "完成",
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
  },
  failed: {
    label: "失败",
    icon: XCircle,
    cls: "bg-red-50 text-red-700",
    bar: "bg-red-500",
  },
  cancelled: {
    label: "已取消",
    icon: Ban,
    cls: "bg-amber-50 text-amber-700",
    bar: "bg-amber-400",
  },
};

const TYPE_CONFIG: Record<JobType, { label: string; icon: React.ElementType }> = {
  pipeline_run: { label: "Pipeline 执行", icon: Layers },
  code_analysis: { label: "代码分析", icon: Code2 },
  skill_execution: { label: "技能执行", icon: Wand2 },
  file_scan: { label: "文件扫描", icon: FileSearch },
  custom: { label: "自定义", icon: Cpu },
};

export const JobDetailPageContent = ({ job }: { job: JobEntity | null }) => {
  const navigate = useNavigate();

  const handleNavigateJobs = () => void navigate({ to: "/jobs" });
  const handleNavigateProject = () => {
    if (!job?.projectId) return;
    void navigate({
      to: "/projects/$projectId",
      params: { projectId: job.projectId },
    });
  };

  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">Job 不存在</p>
        <Button size="sm" variant="link" onClick={handleNavigateJobs}>
          返回列表
        </Button>
      </div>
    );
  }

  const s = STATUS_CONFIG[job.status];
  const t = TYPE_CONFIG[job.type];
  const StatusIcon = s.icon;
  const TypeIcon = t.icon;

  const duration =
    job.startedAt && job.finishedAt
      ? ((job.finishedAt - job.startedAt) / 1000).toFixed(2) + "s"
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button className="h-8 w-8" size="icon" variant="ghost" onClick={handleNavigateJobs}>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{job.title}</h1>
          <p className="font-mono text-[11px] text-muted-foreground">{job.id}</p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
            s.cls
          )}
        >
          <StatusIcon className={cn("h-3.5 w-3.5", job.status === "running" && "animate-spin")} />
          {s.label}
        </span>
      </div>

      {/* Status bar */}
      <div className={cn("h-1 w-full shrink-0", s.bar)} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Meta card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            基本信息
          </div>
          <div>
            <MetaRow
              label="类型"
              value={
                (
                  <span className="flex items-center gap-1.5">
                    <TypeIcon className="h-3 w-3" />
                    {t.label}
                  </span>
                ) as unknown as string
              }
            />
            <MetaRow label="创建时间" value={new Date(job.createdAt).toLocaleString("zh-CN")} />
            <MetaRow
              label="开始时间"
              value={job.startedAt ? new Date(job.startedAt).toLocaleString("zh-CN") : null}
            />
            <MetaRow
              label="结束时间"
              value={job.finishedAt ? new Date(job.finishedAt).toLocaleString("zh-CN") : null}
            />
            <MetaRow label="耗时" value={duration} />
            <MetaRow mono label="Project ID" value={job.projectId} />
            <MetaRow mono label="Pipeline ID" value={job.pipelineId} />
            <MetaRow mono label="Work ID" value={job.workId} />
          </div>

          {/* Related links */}
          {(job.workId ?? job.projectId) && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              {job.projectId && (
                <Button
                  className="h-auto p-0 text-xs"
                  variant="link"
                  onClick={handleNavigateProject}
                >
                  查看项目
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {job.error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="mb-1.5 text-xs font-semibold text-red-600">错误信息</p>
            <pre className="text-xs text-red-700 font-mono whitespace-pre-wrap break-all">
              {job.error}
            </pre>
          </div>
        )}

        {/* Result */}
        {job.result && Object.keys(job.result).length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              执行结果
            </p>
            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(job.result, null, 2)}
            </pre>
          </div>
        )}

        {/* Logs */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">日志输出</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{job.logs.length} 行</span>
          </div>
          {job.logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Terminal className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">暂无日志</p>
            </div>
          ) : (
            <div className="bg-gray-950 p-4 overflow-x-auto max-h-96 overflow-y-auto">
              {job.logs.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="shrink-0 w-8 text-right text-[10px] text-gray-600 font-mono select-none">
                    {i + 1}
                  </span>
                  <span className="text-xs text-gray-200 font-mono whitespace-pre">{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
