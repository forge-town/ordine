import { Handle, Position } from "@xyflow/react";
import { Wand2, CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { SkillNodeData, NodeRunStatus } from "../../_store";
import { QuickAddButton } from "../../QuickAddButton";
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
        selected={selected}
        headerRight={<StatusIcon className={cn("h-4 w-4 shrink-0", color)} />}
        bodyClassName="space-y-2"
      >
        <div
          className={cn("inline-flex items-center rounded-md px-2.5 py-1", bg)}
        >
          <span className="font-mono text-[11px] font-medium text-gray-700">
            {data.skillName || (
              <span className="text-gray-400">未设置 skill</span>
            )}
          </span>
        </div>
        {data.acceptanceCriteria && (
          <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-2.5 py-1.5">
            <p className="text-[11px] leading-relaxed text-amber-700 line-clamp-2">
              ✓ {data.acceptanceCriteria}
            </p>
          </div>
        )}
      </NodeCard>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-full !bg-violet-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-full !bg-violet-400 !border-2 !border-white"
      />

      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <QuickAddButton nodeId={id} nodeType="skill" />
      </div>
    </div>
  );
};
