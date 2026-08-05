import type { TFunction } from "i18next";

/** Pure view helpers used by message cards. No Composer or thread state. */

export const STAGE_RANK: Record<string, number> = {
  thinking: 0,
  analyzing: 1,
  drafting: 2,
  validating: 3,
  done: 4,
};

export type ReversingStep = { detail: string; done: boolean; id: string; title: string };

export const buildReversingSteps = (
  isReversing: boolean,
  stageRank: number,
  t: TFunction,
): ReversingStep[] => {
  const stageOneDone = !isReversing || stageRank >= STAGE_RANK.drafting!;

  return ["structure", "steps", "matched", "draft"].map((step) => ({
    detail: t(`canvas.agentPanel.reversing.steps.${step}Detail`),
    done: step === "draft" ? !isReversing : stageOneDone,
    id: step,
    title: t(`canvas.agentPanel.reversing.steps.${step}`),
  }));
};
