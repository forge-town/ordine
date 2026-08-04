import type { StateCreator } from "zustand";
import type { DecisionSelectMode } from "@repo/schemas";

/**
 * 人类决策的「选中候选」状态，按决策节点 id 归档（支持多个决策节点并行等待）。
 * 选择动作只改本地状态；落地由 DecisionBoard 经 tRPC jobs.resolveDecision 触发。
 * 不设默认勾选（施工手册红线：禁止伪造人类决策）。
 */
export type DecisionSlice = {
  decisionSelections: Record<string, string[]>;
  toggleDecisionCandidate: (
    decisionId: string,
    candidateId: string,
    mode: DecisionSelectMode,
  ) => void;
  clearDecisionSelection: (decisionId: string) => void;
};

const nextSelection = (
  current: string[],
  candidateId: string,
  mode: DecisionSelectMode,
): string[] => {
  if (mode === "single") {
    return current[0] === candidateId ? [] : [candidateId];
  }

  return current.includes(candidateId)
    ? current.filter((id) => id !== candidateId)
    : [...current, candidateId];
};

export const createDecisionSlice =
  <T extends DecisionSlice>(): StateCreator<T, [], [], DecisionSlice> =>
  (set) => ({
    decisionSelections: {},
    toggleDecisionCandidate: (decisionId, candidateId, mode) =>
      set(
        (state) =>
          ({
            decisionSelections: {
              ...state.decisionSelections,
              [decisionId]: nextSelection(
                state.decisionSelections[decisionId] ?? [],
                candidateId,
                mode,
              ),
            },
          }) as unknown as Partial<T>,
      ),
    clearDecisionSelection: (decisionId) =>
      set((state) => {
        const { [decisionId]: _removed, ...rest } = state.decisionSelections;

        return { decisionSelections: rest } as unknown as Partial<T>;
      }),
  });
