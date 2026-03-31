import { Handle, Position } from "@xyflow/react";
import { LogIn } from "lucide-react";
import type { InputNodeData } from "../../_store";
import { QuickAddButton } from "../../components/QuickAddButton";
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
      description="Input Trigger"
      selected={selected}
      bodyClassName="space-y-3"
    >
      <p className="text-[12px] leading-relaxed text-slate-600 line-clamp-2">
        {data.contextDescription}
      </p>
      {data.exampleValue && (
        <p className="font-mono text-[12px] text-slate-500 line-clamp-2 mt-1 px-1">
          {data.exampleValue}
        </p>
      )}
    </NodeCard>

    <Handle
      type="source"
      position={Position.Right}
      className="!h-3.5 !w-3.5 !rounded-full !bg-emerald-500 !border-[3px] !border-white !shadow-sm transition-all hover:!scale-110"
    />

    <div className="opacity-0 group-[.selected]:opacity-100 group-hover:opacity-100 transition-opacity duration-200 absolute right-[-8px] top-1/2 translate-x-full -translate-y-1/2 z-50">
      <QuickAddButton nodeId={id} nodeType="input" />
    </div>
  </div>
);
