import { useTranslation } from "react-i18next";
import { GitFork } from "lucide-react";
import type { DecisionSelectMode } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { DecisionCandidateCard, type DecisionCandidate } from "./DecisionCandidateCard";

export type DecisionBoardViewProps = {
  nodeLabel: string;
  instruction?: string;
  selectMode: DecisionSelectMode;
  candidates: DecisionCandidate[];
  selectedIds: string[];
  submitting: boolean;
  onToggle: (candidateId: string) => void;
  onConfirm: () => void;
};

/** 候选对比 + 单/多选确认的纯展示外壳（store/tRPC 在 DecisionBoard 容器里接）。 */
export const DecisionBoardView = ({
  nodeLabel,
  instruction,
  selectMode,
  candidates,
  selectedIds,
  submitting,
  onToggle,
  onConfirm,
}: DecisionBoardViewProps) => {
  const { t } = useTranslation();
  const multi = selectMode === "multi";
  const canConfirm = selectedIds.length > 0 && !submitting;

  return (
    <div className="absolute inset-0 z-40 grid place-items-center p-6" data-testid="decision-board">
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
      <div className="relative flex max-h-[86%] w-[min(900px,92vw)] flex-col overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong">
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
            <GitFork className="size-3.5 text-foreground/80" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {t("workspace.canvas.decision.title", { node: nodeLabel })}
            </div>
            <div className="text-[10.5px] text-muted-foreground">
              {instruction ||
                t(
                  multi
                    ? "workspace.canvas.decision.hintMulti"
                    : "workspace.canvas.decision.hintSingle",
                )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {candidates.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {candidates.map((candidate, index) => (
                <DecisionCandidateCard
                  key={candidate.nodeId}
                  index={index}
                  candidate={candidate}
                  multi={multi}
                  selected={selectedIds.includes(candidate.nodeId)}
                  onToggle={() => onToggle(candidate.nodeId)}
                />
              ))}
            </div>
          ) : (
            <p className="grid h-32 place-items-center text-xs text-muted-foreground">
              {t("workspace.canvas.decision.empty")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/70 px-4 py-3">
          <span className="text-[11px] text-muted-foreground">
            {t("workspace.canvas.decision.selected", { count: selectedIds.length })}
          </span>
          <Button data-testid="decision-confirm" disabled={!canConfirm} onClick={onConfirm}>
            {t("workspace.canvas.decision.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
};
