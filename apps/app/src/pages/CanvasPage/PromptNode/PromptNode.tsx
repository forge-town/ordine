import { MessageSquareText } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useHarnessCanvasStore, selectNodeRunState } from "../_store";
import type { PromptNodeData } from "@repo/schemas";
import { NodeCard, useNodePortCounts } from "../NodeCard";
import { Textarea } from "@repo/ui/textarea";

export interface PromptNodeProps {
  id: string;
  data: PromptNodeData;
  selected?: boolean;
}

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const PromptNode = ({ id, data, selected }: PromptNodeProps) => {
  const store = useHarnessCanvasStore();
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const { rightPortCount } = useNodePortCounts(id);

  const handleLabelChange = (v: string) => updateNodeData(id, { label: v });
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    updateNodeData(id, { prompt: e.target.value });

  return (
    <NodeCard
      rightHandle
      bodyClassName="space-y-2"
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
        className="nodrag nopan text-xs min-h-[60px] resize-none"
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
