import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { ArtifactPreview } from "../../panels/ArtifactPreview";
import { guessContentType } from "./guessContentType";

export type DecisionCandidate = {
  nodeId: string;
  label: string;
  content: string;
};

type DecisionCandidateCardProps = {
  index: number;
  candidate: DecisionCandidate;
  selected: boolean;
  multi: boolean;
  onToggle: () => void;
};

export const DecisionCandidateCard = ({
  index,
  candidate,
  selected,
  multi,
  onToggle,
}: DecisionCandidateCardProps) => {
  const { t } = useTranslation();

  return (
    <div
      data-testid={`decision-candidate-${index}`}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-surface ring-1 transition-colors",
        selected ? "ring-2 ring-primary" : "ring-border hover:ring-border-strong",
      )}
    >
      <button
        type="button"
        data-testid={`decision-candidate-select-${index}`}
        aria-pressed={selected}
        onClick={onToggle}
        className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-left"
      >
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center border",
            multi ? "rounded" : "rounded-full",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
        >
          {selected && <Check className="size-3" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{candidate.label}</span>
      </button>
      <div className="min-h-0 flex-1 p-2">
        {candidate.content ? (
          <ArtifactPreview
            artifact={{
              kind: "inline",
              contentType: guessContentType(candidate.content),
              content: candidate.content,
            }}
          />
        ) : (
          <p className="p-3 text-xs text-muted-foreground">
            {t("workspace.canvas.decision.noContent")}
          </p>
        )}
      </div>
    </div>
  );
};
