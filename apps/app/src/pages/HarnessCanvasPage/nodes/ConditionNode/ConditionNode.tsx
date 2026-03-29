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
import { QuickAddButton } from "../../QuickAddButton";
import { NodeCard } from "../NodeCard";

export interface ConditionNodeProps {
  id: string;
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

export const ConditionNode = ({ id, data, selected }: ConditionNodeProps) => {
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
        selected={selected}
        headerRight={
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5">
            <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
            <span className={cn("text-[10px] font-medium leading-none", color)}>
              {label}
            </span>
          </div>
        }
        bodyClassName="space-y-2.5"
      >
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            条件表达式
          </p>
          <p className="rounded-lg bg-gray-50 px-2.5 py-1.5 font-mono text-[11px] text-gray-700 line-clamp-2">
            {data.expression || <span className="text-gray-300">未设置</span>}
          </p>
        </div>
        <div>
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            期望结果
          </p>
          <p className="text-xs text-gray-600 line-clamp-1">
            {data.expectedResult}
          </p>
        </div>
      </NodeCard>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-full !bg-amber-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-full !bg-amber-400 !border-2 !border-white"
      />

      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <QuickAddButton nodeId={id} nodeType="condition" />
      </div>
    </div>
  );
};
