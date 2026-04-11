import { Handle, Position } from "@xyflow/react";
import {
  Repeat,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings,
} from "lucide-react";
import { useStore } from "zustand";
import { cn } from "@repo/ui/lib/utils";
import { Input } from "@repo/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
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
    color: "text-indigo-500 animate-spin",
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

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ label: e.target.value });

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

  return (
    <div
      className={cn(
        "group relative rounded-lg border-2 border-dashed bg-transparent transition-all",
        selected
          ? "border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)]"
          : "border-indigo-300/60 hover:border-indigo-400",
        nodeRunStatus === "running" &&
          "border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.3)] animate-pulse",
        nodeRunStatus === "pass" && "border-green-500",
        nodeRunStatus === "fail" && "border-red-500",
        dimmed && "opacity-40 pointer-events-none",
      )}
      style={{ overflow: "visible" }}
    >
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/60 rounded-t-md border-b border-dashed border-indigo-200/50">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-100">
          <Repeat className="h-3.5 w-3.5 text-indigo-600" />
        </div>

        <input
          className="nodrag nopan bg-transparent text-xs font-semibold text-slate-700 flex-1 min-w-0 focus:outline-none"
          value={data.label}
          onChange={handleLabelChange}
          onMouseDown={handleMouseDown}
        />

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status badge */}
          <div className={cn("flex items-center gap-1", color)}>
            <StatusIcon className="h-3 w-3" />
            <span className="text-[10px] font-medium">{statusLabel}</span>
          </div>

          {/* Gear → settings popover */}
          <Popover>
            <PopoverTrigger
              className="nodrag nopan flex h-6 w-6 items-center justify-center rounded hover:bg-indigo-100 transition-colors"
              onMouseDown={handleMouseDown}
            >
              <Settings className="h-3.5 w-3.5 text-indigo-500" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 space-y-3 p-3"
              side="bottom"
              onMouseDown={handleMouseDown}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                循环设置
              </p>

              {/* Max iterations */}
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-slate-500">
                  最大迭代次数
                </p>
                <Input
                  className="nodrag nopan text-[11px] h-7"
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
                <p className="text-[11px] font-medium text-slate-500">
                  通过条件
                </p>
                <div className="flex items-center gap-1">
                  <Input
                    className="nodrag nopan text-[11px] font-mono h-7 flex-1"
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
                      <SelectTrigger className="nodrag nopan w-12 h-7 text-[11px] px-1">
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
                    className="nodrag nopan text-[11px] font-mono h-7 w-14"
                    type="number"
                    value={data.passCondition?.value ?? 0}
                    onChange={handleValueChange}
                    onMouseDown={handleMouseDown}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Handles */}
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
