import { Handle, Position } from "@xyflow/react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
} from "lucide-react";
import type { ConditionNodeData, NodeRunStatus } from "../_store";

interface Props {
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

export const ConditionNode = ({ data, selected }: Props) => {
  const {
    icon: StatusIcon,
    color,
    label,
  } = statusConfig[data.status ?? "idle"];

  return (
    <div
      className={[
        "min-w-[200px] max-w-[240px] rounded-xl border-2 bg-white shadow-sm transition-shadow",
        selected
          ? "border-amber-500 shadow-md shadow-amber-100"
          : "border-amber-200 hover:border-amber-400",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 rounded-t-lg bg-amber-50 px-3 py-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500">
          <ShieldCheck className="h-3 w-3 text-white" />
        </div>
        <span className="flex-1 truncate text-xs font-semibold text-amber-700">
          {data.label}
        </span>
        <div className="flex items-center gap-1">
          <StatusIcon className={["h-3.5 w-3.5 shrink-0", color].join(" ")} />
          <span className={["text-[10px] font-medium", color].join(" ")}>
            {label}
          </span>
        </div>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
            条件表达式
          </p>
          <p className="mt-0.5 rounded bg-gray-50 px-2 py-1 font-mono text-[10px] text-gray-600 line-clamp-2">
            {data.expression}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
            期望结果
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500 line-clamp-1">
            {data.expectedResult}
          </p>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-amber-400 !bg-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-amber-400 !bg-white"
      />
    </div>
  );
};
