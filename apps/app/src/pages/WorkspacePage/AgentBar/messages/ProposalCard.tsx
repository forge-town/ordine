import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { ProgressList } from "./ProgressList";

export type ProposalItem = {
  detail: string;
  title: string;
};

export type ProposalCardProps = {
  items: ProposalItem[];
  onApply?: () => void;
  /** Shown only when blocking diagnostics exist — asks the agent to fix them. */
  onAskFix?: () => void;
  onReject?: () => void;
  onRevise?: () => void;
  subtitle: string;
  title: string;
};

/** Minimal proposal block — text line + left-border node list + inline actions. */
export const ProposalCard = ({
  items,
  onApply,
  onAskFix,
  onReject,
  onRevise,
  subtitle,
  title,
}: ProposalCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2" data-testid="agent-proposal">
      <div className="text-[12px] leading-relaxed text-foreground/90">
        {title}
        <span className="text-muted-foreground"> · {subtitle}</span>
      </div>
      <ProgressList
        items={items.map((item, index) => ({
          detail: item.detail,
          id: `${index}-${item.title}`,
          title: item.title,
        }))}
      />
      <div className="flex items-center gap-1.5 pt-0.5">
        {onAskFix ? (
          <Button
            className="h-7 rounded-lg px-3 text-[11.5px]"
            data-testid="agent-proposal-ask-fix"
            size="sm"
            variant="outline"
            onClick={onAskFix}
          >
            {t("workspace.agentBar.proposal.askFix")}
          </Button>
        ) : null}
        <Button
          className="h-7 rounded-lg px-3 text-[11.5px]"
          data-testid="agent-proposal-apply"
          disabled={Boolean(onAskFix)}
          size="sm"
          onClick={onApply}
        >
          {t("workspace.agentBar.proposal.apply")}
        </Button>
        <Button
          className="h-7 rounded-lg px-2.5 text-[11.5px]"
          data-testid="agent-proposal-revise"
          size="sm"
          variant="outline"
          onClick={onRevise}
        >
          {t("workspace.agentBar.proposal.revise")}
        </Button>
        <Button
          className="h-7 rounded-lg px-2 text-[11.5px] text-muted-foreground"
          data-testid="agent-proposal-reject"
          size="sm"
          variant="ghost"
          onClick={onReject}
        >
          {t("workspace.agentBar.proposal.reject")}
        </Button>
      </div>
    </div>
  );
};
