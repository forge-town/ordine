import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Search,
  Trash2,
  ChevronRight,
  FileText,
  Folder,
  FolderGit2,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { WorkEntity } from "@/models/daos/worksDao";
import type { WorkStatus } from "@/models/tables/works_table";
import { deleteWork } from "@/services/worksService";

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  WorkStatus,
  { label: string; icon: React.ElementType; cls: string; dot: string }
> = {
  pending: {
    label: "待执行",
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
  success: {
    label: "成功",
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
};

const OBJECT_ICON: Record<string, React.ElementType> = {
  file: FileText,
  folder: Folder,
  project: FolderGit2,
};

const STATUS_FILTERS: { value: WorkStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "running", label: "运行中" },
  { value: "pending", label: "待执行" },
  { value: "success", label: "已成功" },
  { value: "failed", label: "失败" },
];

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ── Work row ──────────────────────────────────────────────────────────────────

function WorkRow({
  work,
  onDelete,
}: {
  work: WorkEntity;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const s = STATUS_CONFIG[work.status];
  const StatusIcon = s.icon;
  const ObjIcon = OBJECT_ICON[work.object.type] ?? FileText;

  return (
    <div
      className="group flex cursor-pointer items-center gap-4 border-b border-gray-50 px-5 py-3.5 last:border-0 hover:bg-gray-50 transition-colors"
      onClick={() =>
        void navigate({ to: "/works/$workId", params: { workId: work.id } })
      }
    >
      {/* Status icon */}
      <StatusIcon
        className={cn(
          "h-4 w-4 shrink-0 text-gray-400",
          work.status === "running" && "animate-spin text-gray-600",
          work.status === "failed" && "text-gray-600",
          work.status === "success" && "text-gray-600",
        )}
      />

      {/* Object + pipeline info */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">
            {work.pipelineName}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
            <ObjIcon className="h-3 w-3" />
            <span className="truncate font-mono">
              {work.object.type === "project" ? "整个项目" : work.object.path}
            </span>
          </div>
        </div>
      </div>

      {/* Time */}
      <span className="shrink-0 text-[11px] text-gray-400">
        {new Date(work.createdAt).toLocaleString("zh-CN", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>

      {/* Status badge */}
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium",
          s.cls,
        )}
      >
        {s.label}
      </span>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(work.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500 transition-colors" />
        </button>
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export const WorksPageContent = ({
  works: initial,
}: {
  works: WorkEntity[];
}) => {
  const [works, setWorks] = useState(initial);
  const [filter, setFilter] = useState<WorkStatus | "all">("all");
  const [search, setSearch] = useState("");

  const handleDelete = async (id: string) => {
    await deleteWork({ data: { id } });
    setWorks((prev) => prev.filter((w) => w.id !== id));
  };

  const filtered = works.filter((w) => {
    if (filter !== "all" && w.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        w.pipelineName.toLowerCase().includes(q) ||
        w.object.path.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: works.length,
    running: works.filter((w) => w.status === "running").length,
    success: works.filter((w) => w.status === "success").length,
    failed: works.filter((w) => w.status === "failed").length,
    pending: works.filter((w) => w.status === "pending").length,
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-6">
        <h1 className="text-base font-semibold text-gray-900">Works</h1>
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {works.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="全部" value={stats.total} dot="bg-gray-300" />
          <StatCard label="运行中" value={stats.running} dot="bg-blue-500" />
          <StatCard label="待执行" value={stats.pending} dot="bg-gray-400" />
          <StatCard label="已成功" value={stats.success} dot="bg-emerald-500" />
          <StatCard label="失败" value={stats.failed} dot="bg-red-500" />
        </div>

        {/* Filters + Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-gray-100 bg-white p-1 shadow-sm">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.value
                    ? "bg-gray-100 text-gray-800"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 Pipeline 名称或路径…"
              className="w-full rounded-lg border border-gray-100 bg-white py-2 pl-9 pr-4 text-sm shadow-sm outline-none placeholder:text-gray-400 focus:border-gray-300 focus:ring-0"
            />
          </div>
        </div>

        {/* List */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-8 w-8 text-gray-200" />
              <p className="mt-2 text-sm text-gray-400">暂无 Works 记录</p>
            </div>
          ) : (
            filtered.map((w) => (
              <WorkRow key={w.id} work={w} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
