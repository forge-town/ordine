import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FolderOpen, HardDrive } from "lucide-react";
import { OUTPUT_MODE_ENUM, type OutputMode, type LocalPathOutputNodeData } from "@repo/schemas";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import { NodeCard } from "../NodeCard";
import { FolderBrowserDialog } from "@/components/FolderBrowserDialog/FolderBrowserDialog";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";

export interface OutputLocalPathNodeProps {
  id: string;
  data: LocalPathOutputNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

const MODE_LABEL_KEYS: Record<OutputMode, string> = {
  overwrite: "nodes.outputLocalPathNode.modeOverwrite",
  error_if_exists: "nodes.outputLocalPathNode.modeErrorIfExists",
  auto_rename: "nodes.outputLocalPathNode.modeAutoRename",
};

export const OutputLocalPathNode = ({ id, data, selected }: OutputLocalPathNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const {
    runStatus,
    dimmed,
    nodeCardMode,
    handleOutputLocalPathLabelChange: applyOutputLocalPathLabelChange,
    handleOutputLocalPathChange: applyOutputLocalPathChange,
    handleOutputLocalPathInputChange: applyOutputLocalPathInputChange,
    handleOutputLocalPathFileNameInputChange: applyOutputLocalPathFileNameInputChange,
    handleOutputLocalPathModeChange: applyOutputLocalPathModeChange,
    handleOutputLocalPathDescriptionInputChange: applyOutputLocalPathDescriptionInputChange,
    leftActivePortCount,
    leftActivePortMask,
    leftConnectedPortCount,
    leftConnectedPortMask,
    leftPortCount,
  } = useStore(
    store,
    useShallow((s) => ({
      ...selectNodeRunState(id)(s),
      nodeCardMode: s.nodeCardMode,
      handleOutputLocalPathLabelChange: s.handleOutputLocalPathLabelChange,
      handleOutputLocalPathChange: s.handleOutputLocalPathChange,
      handleOutputLocalPathInputChange: s.handleOutputLocalPathInputChange,
      handleOutputLocalPathFileNameInputChange: s.handleOutputLocalPathFileNameInputChange,
      handleOutputLocalPathModeChange: s.handleOutputLocalPathModeChange,
      handleOutputLocalPathDescriptionInputChange: s.handleOutputLocalPathDescriptionInputChange,
      ...selectNodePortCounts(id)(s),
    })),
  );
  const [browserOpen, setBrowserOpen] = useState(false);

  const handleFolderButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBrowserOpen(true);
  };

  const handleLabelChange = applyOutputLocalPathLabelChange.bind(null, id);

  const handleFolderSelect = applyOutputLocalPathChange.bind(null, id);

  const handleLocalPathInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyOutputLocalPathInputChange(id, e.target.value);
  };

  const handleFileNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyOutputLocalPathFileNameInputChange(id, e.target.value);
  };

  const handleOutputModeChange = (value: OutputMode | null) => {
    if (!value) return;

    applyOutputLocalPathModeChange(id, value);
  };

  const handleDescriptionInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyOutputLocalPathDescriptionInputChange(id, e.target.value);
  };

  const handleBrowserOpenChange = (open: boolean) => {
    setBrowserOpen(open);
  };

  const currentMode = data.outputMode ?? "overwrite";

  return (
    <div className="group relative w-fit overflow-visible">
      <NodeCard
        leftHandle
        bodyClassName="space-y-2"
        compact={nodeCardMode === "compact"}
        description={t("nodes.outputLocalPathNode.description")}
        dimmed={dimmed}
        icon={HardDrive}
        label={data.label}
        leftActivePortCount={leftActivePortCount}
        leftActivePortMask={leftActivePortMask}
        leftConnectedPortCount={leftConnectedPortCount}
        leftConnectedPortMask={leftConnectedPortMask}
        leftHandleCount={leftPortCount}
        runStatus={runStatus}
        selected={selected}
        theme="teal"
        onLabelChange={handleLabelChange}
      >
        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">
            {t("nodes.outputLocalPathNode.pathLabel")}
          </span>
          <Input
            className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] font-semibold text-teal-800 focus:outline-none border-none shadow-none p-0 h-auto"
            placeholder="/Users/you/Desktop/output"
            value={data.localPath}
            onChange={handleLocalPathInputChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
          <Button
            className="nodrag nopan shrink-0 rounded p-0.5 text-teal-400 hover:bg-teal-100 hover:text-teal-700 transition-colors h-auto"
            title={t("nodes.outputLocalPathNode.browseFolder")}
            type="button"
            variant="ghost"
            onClick={handleFolderButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">
            {t("nodes.outputLocalPathNode.filenameLabel")}
          </span>
          <Input
            className="nodrag nopan flex-1 min-w-0 bg-transparent font-mono text-[11px] font-semibold text-teal-800 focus:outline-none border-none shadow-none p-0 h-auto"
            placeholder="output.md"
            value={data.outputFileName ?? ""}
            onChange={handleFileNameInputChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-1">
          <span className="shrink-0 text-[10px] font-medium text-teal-500">
            {t("nodes.outputLocalPathNode.writeModeLabel")}
          </span>
          <Select value={currentMode} onValueChange={handleOutputModeChange}>
            <SelectTrigger
              className="nodrag nopan h-6 flex-1 min-w-0 border-none bg-transparent px-0 py-0 text-[11px] font-semibold text-teal-800 shadow-none focus:ring-0"
              onClick={handleStopPropagation}
              onMouseDown={handleStopPropagation}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(OUTPUT_MODE_ENUM).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(MODE_LABEL_KEYS[mode])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentMode === "error_if_exists" && (
          <div className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{t("nodes.outputLocalPathNode.errorIfExistsWarning")}</span>
          </div>
        )}

        <Textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1 border-none shadow-none min-h-0 p-0"
          placeholder={t("nodes.outputLocalPathNode.descriptionPlaceholder")}
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionInputChange}
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
