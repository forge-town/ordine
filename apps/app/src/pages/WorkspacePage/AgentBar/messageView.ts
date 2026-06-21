import type { TFunction } from "i18next";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import type { AgentBarMessage } from "./_store";

/**
 * AgentBar 的纯视图助手（H2-02 抽出）：消息引用芯片与逆向四步推导，无 React 状态。
 */

type CanvasNodeLike = { id: string; data: { label?: string } };

/** 由消息 metadata.referencedNodeIds 还原可渲染的 RefChips 数据（含钻入路径）。 */
export const buildMessageRefs = (
  message: AgentBarMessage,
  canvasNodes: CanvasNodeLike[],
): WorkspaceCanvasRef[] => {
  const nodeLabelById = new Map(
    canvasNodes.map((node) => [node.id, node.data.label ?? node.id] as const),
  );

  return (message.metadata?.referencedNodeIds ?? []).map((refId) => {
    const path = refId.split("/");
    const baseId = path.at(-1) ?? refId;

    return {
      baseId,
      id: refId,
      kind: "node",
      label: nodeLabelById.get(baseId) ?? baseId,
      path: path.slice(0, -1),
      type: "node",
    };
  });
};

/** N15-01：服务端阶段在真实调用边界推进；rank 用于映射逆向四步完成度。 */
export const STAGE_RANK: Record<string, number> = {
  thinking: 0,
  analyzing: 1,
  drafting: 2,
  validating: 3,
  done: 4,
};

export type ReversingStep = { detail: string; done: boolean; id: string; title: string };

/**
 * 逆向四步由服务端真实阶段驱动（analyzing=第一段进行中，drafting 起第一段三步完成，
 * draft 在响应返回后完成）。无阶段信息时诚实显示进行中。
 */
export const buildReversingSteps = (
  isReversing: boolean,
  stageRank: number,
  t: TFunction,
): ReversingStep[] => {
  const stageOneDone = !isReversing || stageRank >= STAGE_RANK.drafting!;

  return ["structure", "steps", "matched", "draft"].map((step) => ({
    detail: t(`workspace.agentBar.reversing.steps.${step}Detail`),
    done: step === "draft" ? !isReversing : stageOneDone,
    id: step,
    title: t(`workspace.agentBar.reversing.steps.${step}`),
  }));
};
