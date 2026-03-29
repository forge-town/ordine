import { Handle, Position } from "@xyflow/react";
import { LogOut } from "lucide-react";
import type { OutputNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface OutputNodeProps {
  id: string;
  data: OutputNodeData;
  selected?: boolean;
}

export const OutputNode = ({ data, selected }: OutputNodeProps) => (
  <div className="group relative" style={{ overflow: "visible" }}>
    <NodeCard
      theme="sky"
      icon={LogOut}
      label={data.label}
      selected={selected}
      bodyClassName="space-y-2"
    >
      {data.expectedSchema && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            期望产出
          </p>
          <p className="rounded-lg bg-gray-50 px-2.5 py-1.5 font-mono text-[11px] text-gray-500 line-clamp-2">
            {data.expectedSchema}
          </p>
        </div>
      )}
      {data.notes && (
        <p className="text-xs leading-relaxed text-gray-500 line-clamp-2">
          {data.notes}
        </p>
      )}
    </NodeCard>

    <Handle
      type="target"
      position={Position.Left}
      className="!h-3 !w-3 !rounded-full !bg-sky-400 !border-2 !border-white"
    />
  </div>
);
