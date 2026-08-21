import { FolderOutput } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import type { ProjectPathOutputNodeData } from "@repo/schemas";
import { NodeCard, useNodeCardActions } from "../NodeCard";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";

export interface OutputProjectPathNodeProps {
  id: string;
  data: ProjectPathOutputNodeData;
  selected?: boolean;
}

const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

export const OutputProjectPathNode = ({ id, data, selected }: OutputProjectPathNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const nodeCardActions = useNodeCardActions(id);
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const nodeCardMode = useStore(store, (s) => s.nodeCardMode);
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const {
    leftActivePortCount,
    leftActivePortMask,
    leftConnectedPortCount,
    leftConnectedPortMask,
    leftPortCount,
  } = useStore(store, useShallow(selectNodePortCounts(id)));

  const handleLabelChange = (v: string) => updateNodeData(id, { label: v });
  const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateNodeData(id, { projectId: e.target.value });
  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateNodeData(id, { path: e.target.value });
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    updateNodeData(id, { description: e.target.value });

  return (
    <div className="group relative w-fit overflow-visible">
      <NodeCard
        leftHandle
        actions={nodeCardActions}
        bodyClassName="space-y-2"
        compact={nodeCardMode === "compact"}
        detail={data.projectId ?? t("canvas.nodeTypes.output-project-path.label")}
        description={t("nodes.outputProjectPath.description")}
        dimmed={dimmed}
        icon={FolderOutput}
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-1 ring-1 ring-border">
            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
              {t("nodes.outputProjectPath.projectIdLabel")}
            </span>
            <Input
              className="nodrag nopan h-auto min-w-0 flex-1 truncate border-none bg-transparent p-0 font-mono text-[9.5px] text-muted-foreground shadow-none focus:outline-none focus:text-foreground"
              placeholder="project-id"
              value={data.projectId ?? ""}
              onChange={handleProjectIdChange}
              onMouseDown={handleMouseDown}
            />
          </div>
          <div className="flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-1 ring-1 ring-border">
            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
              {t("nodes.outputProjectPath.pathLabel")}
            </span>
            <Input
              className="nodrag nopan h-auto min-w-0 flex-1 truncate border-none bg-transparent p-0 font-mono text-[9.5px] text-muted-foreground shadow-none focus:outline-none focus:text-foreground"
              placeholder="src/output/"
              value={data.path}
              onChange={handlePathChange}
              onMouseDown={handleMouseDown}
            />
          </div>
        </div>
        <Textarea
          className="nodrag nopan min-h-0 w-full resize-none rounded border-none bg-transparent p-0 px-1 text-[11px] text-muted-foreground shadow-none focus:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-border-strong"
          placeholder={t("nodes.outputProjectPath.descriptionPlaceholder")}
          rows={2}
          value={data.description ?? ""}
          onChange={handleDescriptionChange}
          onMouseDown={handleMouseDown}
        />
      </NodeCard>
    </div>
  );
};
