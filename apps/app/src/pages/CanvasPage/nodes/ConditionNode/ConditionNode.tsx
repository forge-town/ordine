import { Handle, Position } from "@xyflow/react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  useHarnessCanvasStore,
  type ConditionNodeData,
  type NodeRunStatus,
} from "../../_store";
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
  const store = useHarnessCanvasStore();
  const update = (patch: Record<string, unknown>) =>
    store.getState().updateNodeData(id, patch);
  const {
    icon: StatusIcon,
    color,
    label: statusLabel,
  } = statusConfig[data.status ?? "idle"];

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="amber"
        icon={ShieldCheck}
        label={data.label}
        onLabelChange={(v) => update({ label: v })}
        description="Condition Check"
        selected={selected}
        headerRight={
          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-white border border-slate-100 shadow-sm px-2 py-1">
            <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
            <span
              className={cn("text-[10px] font-semibold tracking-wide", color)}
            >
              {statusLabel}
            </span>
          </div>
        }
        bodyClassName="space-y-3"
      >
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Expression
          </p>
          <textarea
            className="nodrag nopan font-mono text-[11px] text-slate-700 bg-slate-50 rounded px-1 py-0.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-slate-200"
            rows={2}
            value={data.expression}
            onChange={(e) => update({ expression: e.target.value })}
            placeholder="未设置表达式"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Expected
          </p>
          <input
            className="nodrag nopan text-[11px] font-medium text-slate-600 bg-slate-50 rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-slate-200"
            value={data.expectedResult}
            onChange={(e) => update({ expectedResult: e.target.value })}
            placeholder="期望结果..."
            onMouseDown={(e) => e.stopPropagation()}
          />
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
