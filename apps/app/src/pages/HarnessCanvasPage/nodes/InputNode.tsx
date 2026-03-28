import { Handle, Position } from "@xyflow/react";
import { LogIn } from "lucide-react";
import type { InputNodeData } from "../_store";

interface Props {
  data: InputNodeData;
  selected?: boolean;
}

export const InputNode = ({ data, selected }: Props) => {
  return (
    <div
      className={[
        "min-w-[180px] max-w-[220px] rounded-xl border-2 bg-white shadow-sm transition-shadow",
        selected
          ? "border-emerald-500 shadow-md shadow-emerald-100"
          : "border-emerald-200 hover:border-emerald-400",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 rounded-t-lg bg-emerald-50 px-3 py-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500">
          <LogIn className="h-3 w-3 text-white" />
        </div>
        <span className="truncate text-xs font-semibold text-emerald-700">
          {data.label}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1">
        <p className="text-[11px] text-gray-500 line-clamp-2">
          {data.contextDescription}
        </p>
        {data.exampleValue && (
          <p className="rounded bg-gray-50 px-2 py-1 font-mono text-[10px] text-gray-400 line-clamp-1">
            {data.exampleValue}
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-emerald-400 !bg-white"
      />
    </div>
  );
};
