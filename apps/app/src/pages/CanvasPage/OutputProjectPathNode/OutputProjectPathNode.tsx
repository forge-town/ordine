import { FolderOutput } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useHarnessCanvasStore, selectNodeRunState } from "../_store";
import type { OutputProjectPathNodeData } from "@repo/pipeline-engine/schemas";
import { NodeCard, useNodePortCounts } from "../NodeCard";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";

export interface OutputProjectPathNodeProps {
  id: string;
  data: OutputProjectPathNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const OutputProjectPathNode = ({ id, data, selected }: OutputProjectPathNodeProps) => {
  const store = useHarnessCanvasStore();
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const { leftPortCount } = useNodePortCounts(id);

  const handleLabelChange = (v: string) => updateNodeData(id, { label: v });
  const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateNodeData(id, { projectId: e.target.value });
  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateNodeData(id, { path: e.target.value });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    updateNodeData(id, { description: e.target.value });

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        leftHandle
        bodyClassName="space-y-2"
        description="项目路径输出"
        dimmed={dimmed}
        icon={FolderOutput}
        label={data.label}
        leftHandleCount={leftPortCount}
        runStatus={runStatus}
        selected={selected}
        theme="teal"
        onLabelChange={handleLabelChange}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1">
            <span className="shrink-0 text-[10px] font-medium text-slate-400">项目 ID</span>
            <Input
              className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] text-slate-700 focus:outline-none border-none shadow-none p-0 h-auto"
              placeholder="project-id"
              value={data.projectId ?? ""}
              onChange={handleProjectIdChange}
              onMouseDown={handleMouseDown}
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2.5 py-1">
            <span className="shrink-0 text-[10px] font-medium text-teal-500">路径</span>
            <Input
              className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] font-semibold text-teal-800 focus:outline-none border-none shadow-none p-0 h-auto"
              placeholder="src/output/"
              value={data.path}
              onChange={handlePathChange}
              onMouseDown={handleMouseDown}
            />
          </div>
        </div>
        <Textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1 border-none shadow-none min-h-0 p-0"
          placeholder="描述此输出..."
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionChange}
          onMouseDown={handleMouseDown}
        />
      </NodeCard>
    </div>
  );
};
