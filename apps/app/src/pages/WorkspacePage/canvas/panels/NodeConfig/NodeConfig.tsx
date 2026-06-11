import { useEffect, useState } from "react";
import { useUpdate } from "@refinedev/core";
import { Settings2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toPipelineSnapshot } from "../../_store/canvasTypes";
import { useCanvasStore } from "../../_store/canvasStore";
import { CheckpointSection } from "./CheckpointSection";
import { ExecutorSection } from "./ExecutorSection";
import { IOSection } from "./IOSection";
import { LastRunSection } from "./LastRunSection";
import { PromptSection } from "./PromptSection";
import type { NodeConfigPatch } from "./types";

export type NodeConfigProps = {
  pipelineId: string;
};

export const NodeConfig = ({ pipelineId }: NodeConfigProps) => {
  const { t } = useTranslation();
  const configNodeId = useCanvasStore((state) => state.configNodeId);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const setConfigNodeId = useCanvasStore((state) => state.setConfigNodeId);
  const { mutate: updatePipeline } = useUpdate();
  const [snapshotData, setSnapshotData] = useState<Record<string, unknown> | null>(null);
  const node = nodes.find((item) => item.id === configNodeId);

  useEffect(() => {
    if (!configNodeId) {
      setSnapshotData(null);
      return;
    }
    const current = nodes.find((item) => item.id === configNodeId);
    setSnapshotData(current ? (JSON.parse(JSON.stringify(current.data)) as Record<string, unknown>) : null);
    // Snapshot only when the edited node changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configNodeId]);

  if (!node) {
    return null;
  }

  const persistNodes = (nextNodes: typeof nodes) => {
    updatePipeline({
      errorNotification: false,
      id: pipelineId,
      resource: ResourceName.pipelines,
      successNotification: false,
      values: { nodes: toPipelineSnapshot({ edges, nodes: nextNodes }).nodes },
    });
  };

  const handlePatch = (patch: NodeConfigPatch) => {
    const nextPatch =
      node.data.nodeType === "operation" && typeof patch.label === "string"
        ? { ...patch, operationName: patch.label }
        : patch;
    const nextNodes = nodes.map((item) =>
      item.id === node.id
        ? { ...item, data: { ...item.data, ...nextPatch } as typeof item.data }
        : item,
    );

    updateNodeData(node.id, nextPatch as Partial<typeof node.data>);
    persistNodes(nextNodes);
  };

  const handleReset = () => {
    if (!snapshotData) {
      return;
    }
    const nextNodes = nodes.map((item) =>
      item.id === node.id ? { ...item, data: snapshotData as typeof item.data } : item,
    );
    updateNodeData(node.id, snapshotData as Partial<typeof node.data>);
    persistNodes(nextNodes);
  };

  const dirty = snapshotData ? JSON.stringify(node.data) !== JSON.stringify(snapshotData) : false;
  const handleClose = () => setConfigNodeId(null);

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center p-6"
      data-testid="canvas-v2-node-config"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
      <div
        className="relative flex max-h-full w-[440px] flex-col overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-surface-2">
            <Settings2 className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <input
              className="-mx-1 w-full truncate rounded-md bg-transparent px-1 text-sm font-semibold hover:bg-surface-2 focus:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-border-strong"
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
