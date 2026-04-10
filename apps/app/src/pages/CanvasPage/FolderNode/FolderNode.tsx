import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Folder, FolderOpen, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useHarnessCanvasStore, type FolderNodeData } from "../_store";
import { NodeCard } from "../NodeCard";
import { useNodeRunState } from "../useNodeRunState";
import { FolderBrowser } from "../OutputLocalPathNode/FolderBrowser";
import { FolderTreePreview } from "./FolderTreePreview";
import { Input } from "@repo/ui/input";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";

export interface FolderNodeProps {
  id: string;
  data: FolderNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const FolderNode = ({ id, data, selected }: FolderNodeProps) => {
  const { t } = useTranslation();
  const { runStatus, dimmed } = useNodeRunState(id);
  const store = useHarnessCanvasStore();
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const [browserOpen, setBrowserOpen] = useState(false);
  const update = (patch: Record<string, unknown>) => updateNodeData(id, patch);

  const excludedPaths: string[] = Array.isArray(data.excludedPaths) ? data.excludedPaths : [];

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

  const handleRemoveExcluded = (path: string) => {
    update({ excludedPaths: excludedPaths.filter((p) => p !== path) });
  };

  const handleAddExcluded = (path: string) => {
    if (!excludedPaths.includes(path)) {
      update({ excludedPaths: [...excludedPaths, path] });
    }
  };

  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        bodyClassName="space-y-2"
        description="Folder"
        dimmed={dimmed}
        icon={Folder}
        label={data.label}
        runStatus={runStatus}
        selected={selected}
        theme="orange"
        onLabelChange={handleLabelChange}
      >
        <div className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
          <Input
            className="nodrag nopan font-mono text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none flex-1 min-w-0 border-none shadow-none p-0 h-auto"
            placeholder="src/components/"
            value={data.folderPath}
            onChange={handleFolderPathChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
          <Button
            className="nodrag nopan shrink-0 rounded p-0.5 text-orange-400 hover:bg-orange-100 hover:text-orange-700 transition-colors h-auto"
            title="浏览文件夹"
            type="button"
            variant="ghost"
            onClick={handleFolderButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        </div>

        {excludedPaths.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {excludedPaths.map((ep) => (
              <span
                key={ep}
                className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200"
              >
                {ep}
                <Button
                  aria-label={`移除排除 ${ep}`}
                  className="nodrag nopan rounded-sm p-0 hover:bg-red-200 transition-colors h-auto"
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                  onClick={() => handleRemoveExcluded(ep)}
                  onMouseDown={handleStopPropagation}
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </span>
            ))}
          </div>
        )}

        <FolderTreePreview
          excludedPaths={excludedPaths}
          folderPath={data.folderPath}
          onExclude={handleAddExcluded}
        />

        <Textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1 border-none shadow-none min-h-0 p-0"
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
