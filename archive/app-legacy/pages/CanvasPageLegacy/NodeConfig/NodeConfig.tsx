import { Settings2, X } from "lucide-react";
import { useUpdate } from "@refinedev/core";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useCanvasPageStore } from "../_store";
import { CheckpointSection } from "./CheckpointSection";
import { ExecutorSection } from "./ExecutorSection";
import { IOSection } from "./IOSection";
import { LastRunSection } from "./LastRunSection";
import { PromptSection } from "./PromptSection";
import type { NodeConfigPatch } from "./types";

export const NodeConfig = () => {
  const store = useCanvasPageStore();
  const configNodeId = useStore(store, (state) => state.configNodeId);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const updateNodeData = useStore(store, (state) => state.updateNodeData);
  const setConfigNodeId = useStore(store, (state) => state.setConfigNodeId);
  const { mutate: updatePipeline } = useUpdate();
  const node = nodes.find((item) => item.id === configNodeId);

  if (!node) {
    return null;
  }

  const handlePatch = (patch: NodeConfigPatch) => {
    const nextPatch =
      node.data.nodeType === "operation" && typeof patch.label === "string"
        ? { ...patch, operationName: patch.label }
        : patch;
    const nextNodes = nodes.map((item) =>
      item.id === node.id ? { ...item, data: { ...item.data, ...nextPatch } } : item,
    );

    updateNodeData(node.id, nextPatch);

    if (pipelineId) {
      updatePipeline({
        resource: ResourceName.pipelines,
        id: pipelineId,
        values: { nodes: nextNodes },
        successNotification: false,
        errorNotification: false,
      });
    }
  };

  const handleClose = () => {
    setConfigNodeId(null);
  };
  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handlePatch({ label: event.target.value });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="node-config-panel">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">Node Config</div>
            <div className="truncate text-[10.5px] text-muted-foreground">{node.id}</div>
          </div>
          <Button aria-label="Close Node Config" size="icon" variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`node-config-${node.id}-label`}>Label</Label>
          <Input
            id={`node-config-${node.id}-label`}
            value={String(node.data.label ?? "")}
            onChange={handleLabelChange}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <PromptSection edges={edges} node={node} onPatch={handlePatch} />
        <ExecutorSection edges={edges} node={node} onPatch={handlePatch} />
        <CheckpointSection edges={edges} node={node} onPatch={handlePatch} />
        <LastRunSection edges={edges} node={node} onPatch={handlePatch} />
        <IOSection edges={edges} node={node} onPatch={handlePatch} />
      </div>
    </div>
  );
};
