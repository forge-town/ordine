import { Handle, Position } from "@xyflow/react";
import { Zap, CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { useHarnessCanvasStore, type OperationNodeData, type NodeRunStatus } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface OperationNodeProps {
  id: string;
  data: OperationNodeData;
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
    label: "运行中",
  },
  pass: { icon: CheckCircle2, color: "text-green-500", label: "成功" },
  fail: { icon: XCircle, color: "text-red-500", label: "失败" },
};

export const OperationNode = ({ id, data, selected }: OperationNodeProps) => {
  const store = useHarnessCanvasStore();
  const update = (patch: Record<string, unknown>) => store.getState().updateNodeData(id, patch);

  const { icon: StatusIcon, color, label: statusLabel } = statusConfig[data.status ?? "idle"];

  // Get operation details from store
  const operation = store.getState().getOperationById(data.operationId);

  const handleLabelChange = (v: string) => update({ label: v, operationName: v });

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        bodyClassName="space-y-2"
        description={operation?.description || "自定义操作"}
        headerRight={
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm",
              data.status === "pass" && "bg-green-50 border-green-100",
              data.status === "fail" && "bg-red-50 border-red-100",
              data.status === "running" && "bg-blue-50 border-blue-100",
              (!data.status || data.status === "idle") && "bg-white border-slate-100"
            )}
          >
            <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
            <span className={cn("text-[10px] font-semibold tracking-wide", color)}>
              {statusLabel}
            </span>
          </div>
        }
        icon={Zap}
        label={data.operationName || data.label}
        selected={selected}
        theme="violet"
        onLabelChange={handleLabelChange}
      >
        {operation?.category && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">分类:</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {operation.category}
            </span>
          </div>
        )}

        {/* Config display (read-only summary) */}
        {data.config && Object.keys(data.config).length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              配置
            </p>
            <div className="rounded bg-slate-50 px-2 py-1.5">
              <pre className="text-[9px] text-slate-500 overflow-hidden text-ellipsis">
                {JSON.stringify(data.config, null, 2).slice(0, 100)}
                {JSON.stringify(data.config).length > 100 ? "..." : ""}
              </pre>
            </div>
          </div>
        )}

        {/* Accepted object types */}
        {operation?.acceptedObjectTypes && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              接受的对象类型
            </p>
            <div className="flex flex-wrap gap-1">
              {operation.acceptedObjectTypes.map((type) => (
                <span
                  key={type}
                  className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-600"
                >
                  {type === "file" && "文件"}
                  {type === "folder" && "文件夹"}
                  {type === "project" && "项目"}
                </span>
              ))}
            </div>
          </div>
        )}
      </NodeCard>

      {/* Target handle (input from object or previous operation) */}
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5 bg-violet-500"
        position={Position.Left}
        type="target"
      />
      {/* Source handle (output to next operation or object) */}
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5 bg-violet-500"
        position={Position.Right}
        type="source"
      />
    </div>
  );
};
