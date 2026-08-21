import { MessageSquareText } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import type { PromptObjectNodeData } from "@repo/schemas";
import { NodeCard, useNodeCardActions } from "../NodeCard";
import { Textarea } from "@repo/ui/textarea";

export interface PromptNodeProps {
  id: string;
  data: PromptObjectNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const PromptNode = ({ id, data, selected }: PromptNodeProps) => {
  const store = useCanvasPageStore();
  const nodeCardActions = useNodeCardActions(id);
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const nodeCardMode = useStore(store, (s) => s.nodeCardMode);
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const { rightPortCount } = useStore(store, useShallow(selectNodePortCounts(id)));

  const handleLabelChange = (v: string) => updateNodeData(id, { label: v });
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    updateNodeData(id, { prompt: e.target.value });

  return (
    <NodeCard
      rightHandle
      actions={nodeCardActions}
      bodyClassName="space-y-2"
      compact={nodeCardMode === "compact"}
      detail="Prompt"
      description="Prompt"
      dimmed={dimmed}
      icon={MessageSquareText}
      label={data.label}
      rightHandleCount={rightPortCount}
      runStatus={runStatus}
      selected={selected}
      theme="sky"
      onLabelChange={handleLabelChange}
    >
      <Textarea
        className="nodrag nopan min-h-[60px] resize-none rounded-md border-none bg-surface-2 px-1.5 py-1 text-[10px] text-muted-foreground/85 shadow-none focus:outline-none focus:ring-1 focus:ring-border"
        placeholder="Enter prompt text..."
        rows={3}
        value={data.prompt}
        onChange={handlePromptChange}
        onClick={handleStopPropagation}
        onKeyDown={handleStopPropagation}
      />
    </NodeCard>
  );
};
