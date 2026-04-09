import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Folder, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHarnessCanvasStore, type FolderNodeData } from "../../_store";
import { NodeCard } from "../NodeCard";
import { FolderBrowser } from "../OutputLocalPathNode/FolderBrowser";

export interface FolderNodeProps {
  id: string;
  data: FolderNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const FolderNode = ({ id, data, selected }: FolderNodeProps) => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const [browserOpen, setBrowserOpen] = useState(false);
  const update = (patch: Record<string, unknown>) => store.getState().updateNodeData(id, patch);

  const handleLabelChange = (v: string) => update({ label: v });
  const handleFolderPathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    update({ folderPath: e.target.value });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    update({ description: e.target.value });

  const handleFolderButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBrowserOpen(true);
  };

  const handleFolderSelect = (path: string) => {
    update({ folderPath: path });
  };

  const handleBrowserOpenChange = (open: boolean) => {
    setBrowserOpen(open);
  };

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        bodyClassName="space-y-2"
        description="Folder"
        icon={Folder}
        label={data.label}
        selected={selected}
        theme="orange"
        onLabelChange={handleLabelChange}
      >
        <div className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
          <input
            className="nodrag nopan font-mono text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none flex-1 min-w-0"
            placeholder="src/components/"
            value={data.folderPath}
            onChange={handleFolderPathChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
          <button
            className="nodrag nopan shrink-0 rounded p-0.5 text-orange-400 hover:bg-orange-100 hover:text-orange-700 transition-colors"
            title="浏览文件夹"
            type="button"
            onClick={handleFolderButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>
        <textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          placeholder={t("canvas.folderDescPlaceholder")}
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionChange}
          onMouseDown={handleStopPropagation}
        />
      </NodeCard>

      <FolderBrowser
        open={browserOpen}
        onOpenChange={handleBrowserOpenChange}
        onSelect={handleFolderSelect}
      />

      {/* Object nodes only emit connections — no target handle */}
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full bg-orange-400 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
        position={Position.Right}
        type="source"
      />
    </div>
  );
};
