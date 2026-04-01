import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  Search,
  Filter,
  Trash2,
  ChevronRight,
  Cpu,
  Code2,
  FileSearch,
  Wand2,
  Layers,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { JobEntity } from "@/models/daos/jobsDao";
import type { JobStatus, JobType } from "@/models/tables/jobs_table";
import { deleteJob } from "@/services/jobsService";

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; icon: React.ElementType; cls: string; dot: string }
> = {
  queued: {
    label: "排队中",
    icon: Clock,
    cls: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
  },
  running: {
    label: "运行中",
    icon: Loader2,
    cls: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  done: {
    label: "完成",
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "失败",
    icon: XCircle,
    cls: "bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "已取消",
    icon: Ban,
    cls: "bg-amber-50 text-amber-600",
    dot: "bg-amber-400",
  },
};

const TYPE_CONFIG: Record<JobType, { label: string; icon: React.ElementType }> =
  {
    pipeline_run: { label: "Pipeline", icon: Layers },
    code_analysis: { label: "代码分析", icon: Code2 },
    skill_execution: { label: "技能执行", icon: Wand2 },
    file_scan: { label: "文件扫描", icon: FileSearch },
    custom: { label: "自定义", icon: Cpu },
  };

const STATUS_FILTERS: { value: JobStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "running", label: "运行中" },
  { value: "queued", label: "排队中" },
  { value: "done", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "cancelled", label: "已取消" },
];

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  dot,
}: {
  label: string;
  value: number;
  color: string;
  dot: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={cn("mt-1 text-2xl font-bold", color)}>{value}</p>
    </div>
  );
}

// ── Job row ───────────────────────────────────────────────────────────────────

function JobRow({
  job,
  onClick,
  onDelete,
}: {
  job: JobEntity;
  onClick: () => void;
  onDelete: () => void;
}) {
  const s = STATUS_CONFIG[job.status];
  const t = TYPE_CONFIG[job.type];
  const StatusIcon = s.icon;
  const TypeIcon = t.icon;
  const duration =
    job.startedAt && job.finishedAt
      ? ((job.finishedAt - job.startedAt) / 1000).toFixed(1) + "s"
      : job.startedAt
        ? "进行中"
        : null;

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:border-violet-200 hover:shadow-sm transition-all"
    >
      {/* Status icon */}
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          s.cls,
        )}
      >
        <StatusIcon
          className={cn("h-4 w-4", job.status === "running" && "animate-spin")}
        />
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-gray-800">
            {job.title}
          </p>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
            <TypeIcon className="h-2.5 w-2.5" />
            {t.label}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-400">
          <span className="font-mono">{job.id}</span>
          {job.projectId && (
            <span className="truncate max-w-[120px]">{job.projectId}</span>
          )}
          {duration && <span>{duration}</span>}
          <span>
            {new Date(job.createdAt).toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
          s.cls,
        )}
      >
        {s.label}
      </span>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </button>
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </div>
  );
}

// ── Page content ──────────────────────────────────────────────────────────────

export const JobsPageContent = ({
  jobs: initialJobs,
}: {
  jobs: JobEntity[];
}) => {
  const [jobs, setJobs] = useState<JobEntity[]>(initialJobs);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const navigate = useNavigate();

  const filtered = jobs.filter((j) => {
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      j.title.toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q) ||
      j.type.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleDelete = async (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    await deleteJob({ data: { id } });
  };

  const counts: Record<JobStatus, number> = {
    queued: jobs.filter((j) => j.status === "queued").length,
    running: jobs.filter((j) => j.status === "running").length,
    done: jobs.filter((j) => j.status === "done").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    cancelled: jobs.filter((j) => j.status === "cancelled").length,
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <Activity className="h-4 w-4 text-violet-600" />
        <h1 className="text-base font-semibold text-gray-900">Jobs 监控</h1>
        {counts.running > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            {counts.running} 运行中
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="shrink-0 border-b border-gray-100 bg-gray-50 px-6 py-4">
        <div className="grid grid-cols-5 gap-3">
          <StatCard
            label="排队中"
            value={counts.queued}
            color="text-gray-700"
            dot="bg-gray-400"
          />
          <StatCard
            label="运行中"
            value={counts.running}
            color="text-blue-700"
            dot="bg-blue-500"
          />
          <StatCard
            label="已完成"
            value={counts.done}
            color="text-emerald-700"
            dot="bg-emerald-500"
          />
          <StatCard
            label="失败"
            value={counts.failed}
            color="text-red-700"
            dot="bg-red-500"
          />
          <StatCard
            label="已取消"
            value={counts.cancelled}
            color="text-amber-600"
            dot="bg-amber-400"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-6 py-3">
        <div className="relative w-60">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索 Job ID、标题..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
        </div>

        <Filter className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-violet-600 text-white"
                  : "text-gray-500 hover:bg-gray-100",
              )}
            >
              {f.label}
              {f.value !== "all" && (
                <span className="ml-1 opacity-70">
                  {counts[f.value as JobStatus]}
                </span>
              )}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} / {jobs.length} 条
        </span>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Activity className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-gray-700">
              {search || statusFilter !== "all"
                ? "未找到匹配的 Job"
                : "暂无 Job"}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              {search || statusFilter !== "all"
                ? "尝试其他关键词或状态筛选"
                : "触发 Pipeline 执行后会在此显示"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onClick={() =>
                  void navigate({
                    to: "/jobs/$jobId",
                    params: { jobId: job.id },
                  })
                }
                onDelete={() => void handleDelete(job.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
