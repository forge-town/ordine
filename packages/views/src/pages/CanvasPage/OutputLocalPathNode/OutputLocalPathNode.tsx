import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FolderOpen, HardDrive } from "lucide-react";
import { OUTPUT_MODE_ENUM, type OutputMode, type LocalPathOutputNodeData } from "@repo/schemas";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import { NodeCard } from "../NodeCard";
import { FolderBrowserDialog } from "../../../components/FolderBrowserDialog/FolderBrowserDialog";
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
        <div className="flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-1 ring-1 ring-teal-500/20">
          <span className="shrink-0 text-[10px] font-medium text-teal-700 dark:text-teal-300">
            {t("nodes.outputLocalPathNode.pathLabel")}
          </span>
          <Input
            className="nodrag nopan h-auto min-w-0 flex-1 border-none bg-transparent p-0 font-mono text-[11px] font-semibold text-foreground shadow-none focus:outline-none"
            placeholder="/Users/you/Desktop/output"
            value={data.localPath}
            onChange={handleLocalPathInputChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
          <Button
            className="nodrag nopan h-auto shrink-0 rounded p-0.5 text-teal-500 transition-colors hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-300"
            title={t("nodes.outputLocalPathNode.browseFolder")}
            type="button"
            variant="ghost"
            onClick={handleFolderButtonClick}
            onMouseDown={handleStopPropagation}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-1 ring-1 ring-teal-500/20">
          <span className="shrink-0 text-[10px] font-medium text-teal-700 dark:text-teal-300">
            {t("nodes.outputLocalPathNode.filenameLabel")}
          </span>
          <Input
            className="nodrag nopan h-auto min-w-0 flex-1 border-none bg-transparent p-0 font-mono text-[11px] font-semibold text-foreground shadow-none focus:outline-none"
            placeholder="output.md"
            value={data.outputFileName ?? ""}
            onChange={handleFileNameInputChange}
            onClick={handleStopPropagation}
            onKeyDown={handleStopPropagation}
            onMouseDown={handleStopPropagation}
          />
        </div>

        <div className="flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-1 ring-1 ring-teal-500/20">
          <span className="shrink-0 text-[10px] font-medium text-teal-700 dark:text-teal-300">
            {t("nodes.outputLocalPathNode.writeModeLabel")}
          </span>
          <Select value={currentMode} onValueChange={handleOutputModeChange}>
            <SelectTrigger
              className="nodrag nopan h-6 min-w-0 flex-1 border-none bg-transparent px-0 py-0 text-[11px] font-semibold text-foreground shadow-none focus:ring-0"
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
          <div className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{t("nodes.outputLocalPathNode.errorIfExistsWarning")}</span>
          </div>
        )}

        <Textarea
          className="nodrag nopan min-h-0 w-full resize-none rounded border-none bg-transparent p-0 px-1 text-[11px] text-muted-foreground shadow-none focus:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-border-strong"
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
