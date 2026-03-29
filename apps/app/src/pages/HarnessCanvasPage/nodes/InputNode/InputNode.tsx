import { Handle, Position } from "@xyflow/react";
import { LogIn } from "lucide-react";
import type { InputNodeData } from "../../_store";
import { QuickAddButton } from "../../QuickAddButton";
import { NodeCard } from "../NodeCard";

export interface InputNodeProps {
  id: string;
  data: InputNodeData;
  selected?: boolean;
}

export const InputNode = ({ id, data, selected }: InputNodeProps) => (
  <div className="group relative" style={{ overflow: "visible" }}>
    <NodeCard
      theme="emerald"
      icon={LogIn}
      label={data.label}
      selected={selected}
      bodyClassName="space-y-2"
    >
      <p className="text-xs leading-relaxed text-gray-600 line-clamp-2">
        {data.contextDescription}
      </p>
      {data.exampleValue && (
        <p className="rounded-lg bg-gray-50 px-2.5 py-1.5 font-mono text-[11px] text-gray-500 line-clamp-2">
          {data.exampleValue}
        </p>
      )}
    </NodeCard>

    <Handle
      type="source"
      position={Position.Right}
      className="!h-3 !w-3 !rounded-full !bg-emerald-400 !border-2 !border-white"
    />

    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
      <QuickAddButton nodeId={id} nodeType="input" />
    </div>
  </div>
);
