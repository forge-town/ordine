import { Handle, Position } from "@xyflow/react";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { useStore } from "zustand";
import { useHarnessCanvasStore, type NodeRunStatus } from "../_store";
import { NodeCard } from "../NodeCard";
import { useNodeRunState } from "../useNodeRunState";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";

// Local type definition for legacy condition node
interface ConditionNodeData {
  label: string;
  nodeType: "condition";
  expression: string;
  expectedResult: string;
  status: NodeRunStatus;
  notes?: string;
}

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

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const ConditionNode = ({ id, data, selected }: ConditionNodeProps) => {
  const { runStatus: nodeRunStatus, dimmed } = useNodeRunState(id);
  const store = useHarnessCanvasStore();
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const update = (patch: Record<string, unknown>) => updateNodeData(id, patch);
  const status = data.status ?? "idle";
  const { icon: StatusIcon, color, label: statusLabel } = statusConfig[status];

  const handleLabelChange = (v: string) => update({ label: v });
  const handleExpressionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    update({ expression: e.target.value });
  const handleExpectedResultChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ expectedResult: e.target.value });

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        bodyClassName="space-y-3"
        description="Condition Check"
        dimmed={dimmed}
        headerRight={
          <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-white border border-slate-100 shadow-sm px-2 py-1">
            <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
            <span className={cn("text-[10px] font-semibold tracking-wide", color)}>
              {statusLabel}
            </span>
          </div>
        }
        icon={ShieldCheck}
        label={data.label}
        runStatus={nodeRunStatus}
        selected={selected}
        theme="amber"
        onLabelChange={handleLabelChange}
      >
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Expression
          </p>
          <Textarea
            className="nodrag nopan font-mono text-[11px] text-slate-700 bg-slate-50 rounded px-1 py-0.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-slate-200 border-none shadow-none min-h-0"
            placeholder="未设置表达式"
            rows={2}
            value={data.expression}
            onChange={handleExpressionChange}
            onMouseDown={handleMouseDown}
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Expected
          </p>
          <Input
            className="nodrag nopan text-[11px] font-medium text-slate-600 bg-slate-50 rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-slate-200 border-none shadow-none h-auto"
            placeholder="期望结果..."
            value={data.expectedResult}
            onChange={handleExpectedResultChange}
            onMouseDown={handleMouseDown}
          />
        </div>
      </NodeCard>

      <Handle
        className="absolute h-3.5 w-3.5 rounded-full bg-amber-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full bg-amber-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
        position={Position.Right}
        type="source"
      />
    </div>
  );
};
