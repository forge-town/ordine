import { useState } from "react";
import { Folder, FolderOpen, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import type { FolderObjectNodeData } from "@repo/schemas";
import { NodeCard } from "../NodeCard";
import { FolderBrowserDialog } from "@/components/FolderBrowserDialog/FolderBrowserDialog";
import { FolderTreePreview } from "./FolderTreePreview";
import { Input } from "@repo/ui/input";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";

export interface FolderNodeProps {
  id: string;
  data: FolderObjectNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const FolderNode = ({ id, data, selected }: FolderNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const {
    runStatus,
    dimmed,
    nodeCardMode,
    handleFolderLabelChange: applyFolderLabelChange,
    handleFolderPathChange: applyFolderPathChange,
    handleFolderPathInputChange: applyFolderPathInputChange,
    handleFolderDescriptionInputChange: applyFolderDescriptionInputChange,
    handleNodeAddExcludedPath,
    handleNodeRemoveExcludedPath,
    rightActivePortCount,
    rightActivePortMask,
    rightConnectedPortCount,
    rightConnectedPortMask,
    rightPortCount,
  } = useStore(
    store,
    useShallow((s) => ({
      ...selectNodeRunState(id)(s),
      nodeCardMode: s.nodeCardMode,
      handleFolderLabelChange: s.handleFolderLabelChange,
      handleFolderPathChange: s.handleFolderPathChange,
      handleFolderPathInputChange: s.handleFolderPathInputChange,
      handleFolderDescriptionInputChange: s.handleFolderDescriptionInputChange,
      handleNodeAddExcludedPath: s.handleNodeAddExcludedPath,
      handleNodeRemoveExcludedPath: s.handleNodeRemoveExcludedPath,
      ...selectNodePortCounts(id)(s),
    })),
  );
  const [browserOpen, setBrowserOpen] = useState(false);

  const excludedPaths: string[] = Array.isArray(data.excludedPaths) ? data.excludedPaths : [];

  const handleFolderButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBrowserOpen(true);
  };

  const handleLabelChange = applyFolderLabelChange.bind(null, id);

  const handleFolderSelect = applyFolderPathChange.bind(null, id);

  const handleFolderPathInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFolderPathInputChange(id, e.target.value);
  };

  const handleFolderDescriptionInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyFolderDescriptionInputChange(id, e.target.value);
  };

  const handleBrowserOpenChange = (open: boolean) => {
    setBrowserOpen(open);
  };

  return (
    <div className="group relative w-fit overflow-visible">
      <NodeCard
        rightHandle
        bodyClassName="space-y-2"
        compact={nodeCardMode === "compact"}
        description={t("canvas.nodeTypes.folder.label")}
        dimmed={dimmed}
        icon={Folder}
        label={data.label}
        rightActivePortCount={rightActivePortCount}
        rightActivePortMask={rightActivePortMask}
        rightConnectedPortCount={rightConnectedPortCount}
        rightConnectedPortMask={rightConnectedPortMask}
        rightHandleCount={rightPortCount}
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
            onChange={handleFolderPathInputChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
          <Button
            className="nodrag nopan shrink-0 rounded p-0.5 text-orange-400 hover:bg-orange-100 hover:text-orange-700 transition-colors h-auto"
            title={t("canvas.browseFolder")}
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
                  aria-label={`${t("canvas.removeExclude")} ${ep}`}
                  className="nodrag nopan rounded-sm p-0 hover:bg-red-200 transition-colors h-auto"
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                  onClick={handleNodeRemoveExcludedPath.bind(null, id, ep)}
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
          onExclude={handleNodeAddExcludedPath.bind(null, id)}
        />

        <Textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1 border-none shadow-none min-h-0 p-0"
          placeholder={t("canvas.folderDescPlaceholder")}
          rows={2}
          value={data.description ?? ""}
          onChange={handleFolderDescriptionInputChange}
          onMouseDown={handleStopPropagation}
        />
      </NodeCard>

      <FolderBrowserDialog
        open={browserOpen}
        onOpenChange={handleBrowserOpenChange}
        onSelect={handleFolderSelect}
      />
    </div>
  );
};
