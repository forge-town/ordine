import { Handle, Position } from "@xyflow/react";
import { LogOut } from "lucide-react";
import type { OutputNodeData } from "../_store";

interface Props {
  data: OutputNodeData;
  selected?: boolean;
}

export const OutputNode = ({ data, selected }: Props) => {
  return (
    <div
      className={[
        "min-w-[180px] max-w-[220px] rounded-xl border-2 bg-white shadow-sm transition-shadow",
        selected
          ? "border-sky-500 shadow-md shadow-sky-100"
          : "border-sky-200 hover:border-sky-400",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 rounded-t-lg bg-sky-50 px-3 py-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sky-500">
          <LogOut className="h-3 w-3 text-white" />
        </div>
        <span className="truncate text-xs font-semibold text-sky-700">
          {data.label}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1">
        {data.expectedSchema && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              期望产出
            </p>
            <p className="mt-0.5 rounded bg-gray-50 px-2 py-1 font-mono text-[10px] text-gray-500 line-clamp-2">
              {data.expectedSchema}
            </p>
          </div>
        )}
        {data.notes && (
          <p className="text-[11px] text-gray-400 line-clamp-2">{data.notes}</p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-sky-400 !bg-white"
      />
    </div>
  );
};
