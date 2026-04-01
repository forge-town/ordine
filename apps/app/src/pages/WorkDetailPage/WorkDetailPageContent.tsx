import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Terminal,
  Info,
  FileText,
  Folder,
  FolderGit2,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { WorkEntity } from "@/models/daos/worksDao";
import type { WorkStatus } from "@/models/tables/works_table";

const STATUS_CONFIG: Record<
  WorkStatus,
  { label: string; icon: React.ElementType; cls: string; bar: string }
> = {
  pending: {
    label: "待执行",
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
  success: {
    label: "成功",
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
};

const OBJECT_ICON: Record<string, React.ElementType> = {
  file: FileText,
  folder: Folder,
  project: FolderGit2,
};

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 border-b border-gray-50 py-2.5 last:border-0">
      <span className="w-24 shrink-0 text-xs text-gray-400">{label}</span>
      <span
        className={cn(
          "flex-1 break-all text-xs text-gray-700",
          mono && "font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export const WorkDetailPageContent = ({
  work,
}: {
  work: WorkEntity | null;
}) => {
  const navigate = useNavigate();

  if (!work) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <XCircle className="h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Work 不存在</p>
        <button
          onClick={() => void navigate({ to: "/works" })}
          className="text-xs text-gray-500 hover:underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  const s = STATUS_CONFIG[work.status];
  const StatusIcon = s.icon;
  const ObjIcon = OBJECT_ICON[work.object.type] ?? FileText;

  const duration =
    work.startedAt && work.finishedAt
      ? ((work.finishedAt - work.startedAt) / 1000).toFixed(2) + "s"
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <button
          onClick={() => void navigate({ to: "/works" })}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-gray-900">
            {work.pipelineName}
          </h1>
          <p className="font-mono text-[11px] text-gray-400">{work.id}</p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
            s.cls,
          )}
        >
          <StatusIcon
            className={cn(
              "h-3.5 w-3.5",
              work.status === "running" && "animate-spin",
            )}
          />
          {s.label}
        </span>
      </div>

      {/* Status bar */}
      <div className={cn("h-1 w-full shrink-0", s.bar)} />

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {/* Meta card */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <Info className="h-3.5 w-3.5" />
            基本信息
          </div>
          <div>
            <MetaRow label="Pipeline" value={work.pipelineName} />
            <div className="flex items-start gap-3 border-b border-gray-50 py-2.5 last:border-0">
              <span className="w-24 shrink-0 text-xs text-gray-400">
                触发对象
              </span>
              <span className="flex flex-1 items-center gap-1.5 break-all text-xs text-gray-700">
                <ObjIcon className="h-3 w-3 shrink-0" />
                {work.object.type === "project" ? "整个项目" : work.object.path}
              </span>
            </div>
            <MetaRow
              label="创建时间"
              value={new Date(work.createdAt).toLocaleString("zh-CN")}
            />
            <MetaRow
              label="开始时间"
              value={
                work.startedAt
                  ? new Date(work.startedAt).toLocaleString("zh-CN")
                  : null
              }
            />
            <MetaRow
              label="结束时间"
              value={
                work.finishedAt
                  ? new Date(work.finishedAt).toLocaleString("zh-CN")
                  : null
              }
            />
            <MetaRow label="耗时" value={duration} />
            <MetaRow label="Project ID" value={work.projectId} mono />
            <MetaRow label="Pipeline ID" value={work.pipelineId} mono />
          </div>
        </div>

        {/* Logs */}
        {work.logs.length > 0 && (
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <Terminal className="h-3.5 w-3.5" />
              执行日志
              <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 normal-case tracking-normal">
                {work.logs.length} 行
              </span>
            </div>
            <div className="overflow-x-auto bg-gray-950 p-4">
              <pre className="font-mono text-[11px] leading-relaxed text-gray-200">
                {work.logs.map((line, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-8 shrink-0 select-none text-right text-gray-600">
                      {i + 1}
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
