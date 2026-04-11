import { Handle, Position } from "@xyflow/react";
import { Repeat, Circle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useStore } from "zustand";
import { cn } from "@repo/ui/lib/utils";
import { Input } from "@repo/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import {
  useHarnessCanvasStore,
  type LoopNodeData,
  type NodeRunStatus,
} from "../_store";
import { NodeCard } from "../NodeCard";
import { useNodeRunState } from "../useNodeRunState";

export interface LoopNodeProps {
  id: string;
  data: LoopNodeData;
  selected?: boolean;
}

const statusConfig: Record<
  NodeRunStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  idle: { icon: Circle, color: "text-gray-400", label: "待运行" },
  running: {
    icon: Loader2,
    color: "text-blue-500 animate-spin",
    label: "循环中",
  },
  pass: { icon: CheckCircle2, color: "text-green-500", label: "通过" },
  fail: { icon: XCircle, color: "text-red-500", label: "已退出" },
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: "=",
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
};

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const LoopNode = ({ id, data, selected }: LoopNodeProps) => {
  const { runStatus: nodeRunStatus, dimmed } = useNodeRunState(id);
  const store = useHarnessCanvasStore();
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const update = (patch: Record<string, unknown>) => updateNodeData(id, patch);

  const status = data.status ?? "idle";
  const { icon: StatusIcon, color, label: statusLabel } = statusConfig[status];

  const handleLabelChange = (v: string) => update({ label: v });

  const handleMaxIterationsChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const val = Number.parseInt(e.target.value, 10);
    if (!Number.isNaN(val) && val >= 1 && val <= 20) {
      update({ maxIterations: val });
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    update({ passCondition: { ...data.passCondition, field: e.target.value } });
  };

  const handleOperatorChange = (value: string | null) => {
    if (value) {
      update({ passCondition: { ...data.passCondition, operator: value } });
    }
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number.parseFloat(e.target.value);
    if (!Number.isNaN(val)) {
      update({ passCondition: { ...data.passCondition, value: val } });
    }
  };

  const childCount = data.childNodeIds?.length ?? 0;

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        bodyClassName="space-y-3"
        description={`${childCount} 子节点 · 最多 ${data.maxIterations} 次`}
        dimmed={dimmed}
        headerRight={
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm",
              status === "pass" && "bg-green-50 border-green-100",
              status === "fail" && "bg-red-50 border-red-100",
              status === "running" && "bg-indigo-50 border-indigo-100",
              status === "idle" && "bg-white border-slate-100",
            )}
          >
            <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
            <span
              className={cn("text-[10px] font-semibold tracking-wide", color)}
            >
              {statusLabel}
            </span>
          </div>
        }
        icon={Repeat}
        label={data.label}
        runStatus={nodeRunStatus}
        selected={selected}
        theme="indigo"
        onLabelChange={handleLabelChange}
      >
        {/* Max iterations */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            最大迭代次数
          </p>
          <Input
            className="nodrag nopan text-[11px] font-medium text-slate-600 bg-slate-50 rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-slate-200 border-none shadow-none h-auto"
            max={20}
            min={1}
            type="number"
            value={data.maxIterations}
            onChange={handleMaxIterationsChange}
            onMouseDown={handleMouseDown}
          />
        </div>

        {/* Pass condition */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            通过条件
          </p>
          <div className="flex items-center gap-1">
            <Input
              className="nodrag nopan text-[11px] font-mono text-slate-600 bg-slate-50 rounded px-1 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-slate-200 border-none shadow-none h-auto"
              placeholder="stats.errors"
              value={data.passCondition?.field ?? ""}
              onChange={handleFieldChange}
              onMouseDown={handleMouseDown}
            />
            <div onMouseDown={handleMouseDown}>
              <Select
                value={data.passCondition?.operator ?? "eq"}
                onValueChange={handleOperatorChange}
              >
                <SelectTrigger className="nodrag nopan w-12 h-6 text-[11px] border-none shadow-none bg-slate-50 px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              className="nodrag nopan text-[11px] font-mono text-slate-600 bg-slate-50 rounded px-1 py-0.5 w-12 focus:outline-none focus:ring-1 focus:ring-slate-200 border-none shadow-none h-auto"
              type="number"
              value={data.passCondition?.value ?? 0}
              onChange={handleValueChange}
              onMouseDown={handleMouseDown}
            />
          </div>
        </div>

        {/* Child nodes count */}
        {childCount > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 bg-indigo-50 rounded px-2 py-1">
            <Repeat className="h-3 w-3" />
            <span>{childCount} 个循环子节点</span>
          </div>
        )}
      </NodeCard>

      <Handle
        className="absolute h-3.5 w-3.5 rounded-full bg-indigo-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full bg-indigo-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
        position={Position.Right}
        type="source"
      />
    </div>
  );
};
