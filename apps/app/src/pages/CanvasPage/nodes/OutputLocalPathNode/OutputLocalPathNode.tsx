import { Handle, Position } from "@xyflow/react";
import { HardDrive } from "lucide-react";
import { useHarnessCanvasStore, type OutputLocalPathNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface OutputLocalPathNodeProps {
  id: string;
  data: OutputLocalPathNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const OutputLocalPathNode = ({ id, data, selected }: OutputLocalPathNodeProps) => {
  const store = useHarnessCanvasStore();
  const update = (patch: Record<string, unknown>) => store.getState().updateNodeData(id, patch);

  const handleLabelChange = (v: string) => update({ label: v });
  const handleLocalPathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ localPath: e.target.value });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    update({ description: e.target.value });

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="teal"
        icon={HardDrive}
        label={data.label}
        onLabelChange={handleLabelChange}
        description="本地路径输出"
        selected={selected}
        bodyClassName="space-y-2"
      >
        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2.5 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">路径</span>
          <input
            className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] font-semibold text-teal-800 focus:outline-none"
            value={data.localPath}
            onChange={handleLocalPathChange}
            placeholder="/home/user/output/"
            onMouseDown={handleMouseDown}
          />
        </div>
        <textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionChange}
          placeholder="描述此输出..."
          onMouseDown={handleMouseDown}
        />
      </NodeCard>

      {/* Output nodes only receive connections — no source handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="absolute h-3.5 w-3.5 rounded-full bg-teal-600 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
      />
    </div>
  );
};
