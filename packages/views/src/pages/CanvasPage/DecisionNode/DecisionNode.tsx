import { ListChecks } from "lucide-react";
import type { ChangeEvent, SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import type { DecisionNodeData } from "@repo/schemas";
import { Textarea } from "@repo/ui/textarea";
import { selectNodePortCounts, selectNodeRunState, useCanvasPageStore } from "../_store";
import { NodeCard, useNodeCardActions } from "../NodeCard";

export interface DecisionNodeProps {
  id: string;
  data: DecisionNodeData;
  selected?: boolean;
}

const stopCanvasInteraction = (event: SyntheticEvent) => event.stopPropagation();

export const DecisionNode = ({ id, data, selected }: DecisionNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const nodeCardActions = useNodeCardActions(id);
  const { runStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const nodeCardMode = useStore(store, (state) => state.nodeCardMode);
  const updateNodeData = useStore(store, (state) => state.updateNodeData);
  const {
    leftActivePortCount,
    leftActivePortMask,
    leftConnectedPortCount,
    leftConnectedPortMask,
    leftPortCount,
    rightActivePortCount,
    rightActivePortMask,
    rightConnectedPortCount,
    rightConnectedPortMask,
    rightPortCount,
  } = useStore(store, useShallow(selectNodePortCounts(id)));
  const modeLabel =
    data.selectMode === "multi"
      ? t("nodes.decision.modeMulti", { defaultValue: "Multiple choice" })
      : t("nodes.decision.modeSingle", { defaultValue: "Single choice" });
  const handleModeChange = (event: ChangeEvent<HTMLSelectElement>) =>
    updateNodeData(id, { selectMode: event.target.value as DecisionNodeData["selectMode"] });
  const handleInstructionChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    updateNodeData(id, { instruction: event.target.value });

  return (
    <NodeCard
      leftHandle
      rightHandle
      actions={nodeCardActions}
      bodyClassName="space-y-2"
      compact={nodeCardMode === "compact"}
      detail={modeLabel}
      description={
        data.description ??
        t("nodes.decision.description", { defaultValue: "Pause for a human decision" })
      }
      dimmed={dimmed}
      icon={ListChecks}
      label={data.label}
      leftActivePortCount={leftActivePortCount}
      leftActivePortMask={leftActivePortMask}
      leftConnectedPortCount={leftConnectedPortCount}
      leftConnectedPortMask={leftConnectedPortMask}
      leftHandleCount={leftPortCount}
      rightActivePortCount={rightActivePortCount}
      rightActivePortMask={rightActivePortMask}
      rightConnectedPortCount={rightConnectedPortCount}
      rightConnectedPortMask={rightConnectedPortMask}
      rightHandleCount={rightPortCount}
      runStatus={runStatus}
      selected={selected}
      theme="amber"
      onLabelChange={(label) => updateNodeData(id, { label })}
    >
      <select
        aria-label={t("nodes.decision.modeLabel", { defaultValue: "Decision mode" })}
        className="nodrag nopan h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[10px] text-foreground outline-none focus:border-ring"
        value={data.selectMode}
        onChange={handleModeChange}
        onClick={stopCanvasInteraction}
        onPointerDown={stopCanvasInteraction}
      >
        <option value="single">
          {t("nodes.decision.modeSingle", { defaultValue: "Single choice" })}
        </option>
        <option value="multi">
          {t("nodes.decision.modeMulti", { defaultValue: "Multiple choice" })}
        </option>
      </select>
      <Textarea
        className="nodrag nopan min-h-[52px] resize-none rounded-md border-none bg-surface-2 px-1.5 py-1 text-[10px] text-muted-foreground/85 shadow-none focus:outline-none focus:ring-1 focus:ring-border"
        placeholder={t("nodes.decision.instructionPlaceholder", {
          defaultValue: "Tell the reviewer what to decide…",
        })}
        rows={2}
        value={data.instruction ?? ""}
        onChange={handleInstructionChange}
        onClick={stopCanvasInteraction}
        onKeyDown={stopCanvasInteraction}
        onPointerDown={stopCanvasInteraction}
      />
    </NodeCard>
  );
};
