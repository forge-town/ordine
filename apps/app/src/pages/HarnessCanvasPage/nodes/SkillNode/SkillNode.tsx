import { Handle, Position } from "@xyflow/react";
import { Wand2, CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { SkillNodeData, NodeRunStatus } from "../../_store";
import { QuickAddButton } from "../../components/QuickAddButton";
import { NodeCard } from "../NodeCard";

export interface SkillNodeProps {
  id: string;
  data: SkillNodeData;
  selected?: boolean;
}

const statusConfig: Record<
  NodeRunStatus,
  { icon: React.ElementType; color: string; bg: string }
> = {
  idle: { icon: Circle, color: "text-gray-400", bg: "bg-gray-50" },
  running: {
    icon: Loader2,
    color: "text-blue-500 animate-spin",
    bg: "bg-blue-50",
  },
  pass: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
  fail: { icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
};

export const SkillNode = ({ id, data, selected }: SkillNodeProps) => {
  const { icon: StatusIcon, color, bg } = statusConfig[data.status ?? "idle"];

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="violet"
        icon={Wand2}
        label={data.label}
        description="Skill Node"
        selected={selected}
        headerRight={<StatusIcon className={cn("h-4 w-4 shrink-0", color)} />}
        bodyClassName="space-y-3"
      >
        <div
          className={cn("inline-flex w-full items-center rounded-md border border-slate-100 px-3 py-1.5", bg)}
        >
          <span className="font-mono text-[11px] font-semibold text-slate-700 truncate">
            {data.skillName || (
              <span className="text-slate-400 font-normal">未设置 skill</span>
            )}
          </span>
        </div>
        {data.acceptanceCriteria && (
          <div className="rounded-md border border-amber-200/60 bg-amber-50/50 p-2 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400" />
            <p className="text-[11px] leading-relaxed text-amber-900/80 line-clamp-2">
              <span className="font-semibold text-amber-600 mr-1">AC:</span>
              {data.acceptanceCriteria}
            </p>
          </div>
        )}
      </NodeCard>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3.5 !w-3.5 !rounded-full !bg-violet-500 !border-[3px] !border-white !shadow-sm transition-all hover:!scale-110"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3.5 !w-3.5 !rounded-full !bg-violet-500 !border-[3px] !border-white !shadow-sm transition-all hover:!scale-110"
      />

      <div className="opacity-0 group-[.selected]:opacity-100 group-hover:opacity-100 transition-opacity duration-200 absolute right-[-8px] top-1/2 translate-x-full -translate-y-1/2 z-50">
        <QuickAddButton nodeId={id} nodeType="skill" />
      </div>
    </div>
  );
};
