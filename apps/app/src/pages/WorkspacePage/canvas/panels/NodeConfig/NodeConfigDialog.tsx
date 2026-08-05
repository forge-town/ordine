import { useState } from "react";
import { Settings2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useCanvasStore, useCanvasStoreApi } from "../../_store/canvasStore";
import { toPipelineSnapshot, type CanvasNode } from "../../_store/canvasTypes";
import { CheckpointSection } from "./CheckpointSection";
import { ExecutorSection } from "./ExecutorSection";
import { IOSection } from "./IOSection";
import { LastRunSection } from "./LastRunSection";
import { PromptSection } from "./PromptSection";
import type { NodeConfigPatch } from "./types";
import { usePipelineSnapshotPersistence } from "../usePipelineSnapshotPersistence";

type NodeConfigDialogProps = {
  node: CanvasNode;
  pipelineId: string;
};

const handleDialogClick = (event: React.MouseEvent) => event.stopPropagation();

export const NodeConfigDialog = ({ node, pipelineId }: NodeConfigDialogProps) => {
  const { t } = useTranslation();
  const edges = useCanvasStore((state) => state.edges);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const setConfigNodeId = useCanvasStore((state) => state.setConfigNodeId);
  const canvasStore = useCanvasStoreApi();
  const persistSnapshot = usePipelineSnapshotPersistence(pipelineId);
  const [snapshotData] = useState<Record<string, unknown>>(() => structuredClone(node.data));

  const handlePatch = (patch: NodeConfigPatch) => {
    const nextPatch =
      node.data.nodeType === "operation" && typeof patch.label === "string"
        ? { ...patch, operationName: patch.label }
        : patch;
    updateNodeData(node.id, nextPatch as Partial<typeof node.data>);
    const state = canvasStore.getState();
    persistSnapshot(toPipelineSnapshot({ edges: state.edges, nodes: state.nodes }));
  };

  const handleReset = () => {
    updateNodeData(node.id, snapshotData as Partial<typeof node.data>);
    const state = canvasStore.getState();
    persistSnapshot(toPipelineSnapshot({ edges: state.edges, nodes: state.nodes }));
  };

  const dirty = JSON.stringify(node.data) !== JSON.stringify(snapshotData);
  const handleClose = () => setConfigNodeId(null);

  return (
    <div
      aria-label={t("workspace.canvas.nodeConfig.editable")}
      aria-modal="true"
      className="absolute inset-0 z-40 grid place-items-center p-6"
      data-testid="canvas-v2-node-config"
      role="dialog"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
      <div
        className="relative flex max-h-full w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-border"
        onClick={handleDialogClick}
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <Settings2 className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <Input
              className="-mx-1 h-auto w-full truncate border-0 bg-transparent px-1 py-0 text-sm font-semibold shadow-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-1"
              data-testid="node-config-label"
              value={String(node.data.label ?? "")}
              onChange={(event) => handlePatch({ label: event.target.value })}
            />
            <div className="px-1 text-[10.5px] text-muted-foreground">
              {node.type} · {t("workspace.canvas.nodeConfig.editable")}
            </div>
          </div>
          <Button
            aria-label={t("workspace.canvas.nodeConfig.close")}
            data-testid="node-config-close"
            size="icon"
            variant="ghost"
            onClick={handleClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <PromptSection edges={edges} node={node} onPatch={handlePatch} />
          <ExecutorSection edges={edges} node={node} onPatch={handlePatch} />
          <CheckpointSection edges={edges} node={node} onPatch={handlePatch} />
          <LastRunSection edges={edges} node={node} onPatch={handlePatch} />
          <IOSection edges={edges} node={node} onPatch={handlePatch} />
        </div>

        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
          <Button className="flex-1" data-testid="node-config-done" onClick={handleClose}>
            {t("workspace.canvas.nodeConfig.done")}
          </Button>
          <Button
            data-testid="node-config-reset"
            disabled={!dirty}
            variant="outline"
            onClick={handleReset}
          >
            {t("workspace.canvas.nodeConfig.reset")}
          </Button>
        </div>
      </div>
    </div>
  );
};
