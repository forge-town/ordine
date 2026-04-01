import { Handle, Position } from "@xyflow/react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { ConditionNodeData, NodeRunStatus } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface ConditionNodeProps {
  data: ConditionNodeData;
  selected?: boolean;
}

const statusConfig: Record<
  NodeRunStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  idle: { icon: Circle, color: "text-gray-400", label: "待验收" },
  running: {
    icon: Loader2,
    color: "text-blue-500 animate-spin",
    label: "检查中",
  },
  pass: { icon: CheckCircle2, color: "text-green-500", label: "通过" },
  fail: { icon: XCircle, color: "text-red-500", label: "失败" },
};

export const ConditionNode = ({ data, selected }: ConditionNodeProps) => {
  const {
    icon: StatusIcon,
    color,
    label,
  } = statusConfig[data.status ?? "idle"];

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="amber"
        icon={ShieldCheck}
        label={data.label}
        description="Condition Check"
        selected={selected}
        headerRight={
          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-white border border-slate-100 shadow-sm px-2 py-1">
            <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
            <span
              className={cn("text-[10px] font-semibold tracking-wide", color)}
            >
              {label}
            </span>
          </div>
        }
        bodyClassName="space-y-3"
      >
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Expression
          </p>
          <p className="font-mono text-[12px] text-slate-700 line-clamp-2 px-1">
            {data.expression || (
              <span className="text-slate-400 italic">未设置表达式</span>
            )}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Expected
          </p>
          <p className="text-[12px] font-medium text-slate-600 line-clamp-1">
            {data.expectedResult || (
              <span className="text-slate-400 italic">...</span>
            )}
          </p>
        </div>
      </NodeCard>

      <Handle
        type="target"
        position={Position.Left}
        className="absolute h-3.5 w-3.5 rounded-full bg-amber-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="absolute h-3.5 w-3.5 rounded-full bg-amber-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
      />
    </div>
  );
};
