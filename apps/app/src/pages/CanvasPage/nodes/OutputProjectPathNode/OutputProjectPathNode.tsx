import { Handle, Position } from "@xyflow/react";
import { FolderOutput } from "lucide-react";
import { useStore } from "zustand";
import { useHarnessCanvasStore, type OutputProjectPathNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";

export interface OutputProjectPathNodeProps {
  id: string;
  data: OutputProjectPathNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const OutputProjectPathNode = ({ id, data, selected }: OutputProjectPathNodeProps) => {
  const store = useHarnessCanvasStore();
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const update = (patch: Record<string, unknown>) => updateNodeData(id, patch);

  const handleLabelChange = (v: string) => update({ label: v });
  const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ projectId: e.target.value });
  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ path: e.target.value });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    update({ description: e.target.value });

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        bodyClassName="space-y-2"
        description="项目路径输出"
        icon={FolderOutput}
        label={data.label}
        selected={selected}
        theme="teal"
        onLabelChange={handleLabelChange}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1">
            <span className="shrink-0 text-[10px] font-medium text-slate-400">项目 ID</span>
            <input
              className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] text-slate-700 focus:outline-none"
              placeholder="project-id"
              value={data.projectId ?? ""}
              onChange={handleProjectIdChange}
              onMouseDown={handleMouseDown}
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2.5 py-1">
            <span className="shrink-0 text-[10px] font-medium text-teal-500">路径</span>
            <input
              className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] font-semibold text-teal-800 focus:outline-none"
              placeholder="src/output/"
              value={data.path}
              onChange={handlePathChange}
              onMouseDown={handleMouseDown}
            />
          </div>
        </div>
        <textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          placeholder="描述此输出..."
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionChange}
          onMouseDown={handleMouseDown}
        />
      </NodeCard>

      {/* Output nodes only receive connections — no source handle */}
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full bg-teal-500 border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5"
        position={Position.Left}
        type="target"
      />
    </div>
  );
};
