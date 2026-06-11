import { useTranslation } from "react-i18next";
import type { WorkspacePhase } from "@repo/schemas";
import { Assistant, ProgressList, SuggestionList } from "./messages";

export type AgentBodyProps = {
  distillContent?: React.ReactNode;
  phase: WorkspacePhase;
  reversingSteps?: { detail: string; done: boolean; id: string; title: string }[];
  runContent?: React.ReactNode;
  onSuggestGoal?: (goal: string) => void;
  onSuggestReverse?: () => void;
};

/**
 * Phase scaffold for the minimal Agent Bar. Real conversation messages render
 * separately — this only contributes phase-specific framing.
 */
export const AgentBody = ({
  distillContent,
  onSuggestGoal,
  onSuggestReverse,
  phase,
  reversingSteps,
  runContent,
}: AgentBodyProps) => {
  const { t } = useTranslation();

  if (phase === "empty") {
    return (
      <>
        <Assistant>{t("workspace.agentBar.empty.intro")}</Assistant>
        <SuggestionList
          items={[
            {
              id: "suggest-quiz",
              label: t("workspace.agentBar.empty.suggestQuiz"),
              onSelect: () => onSuggestGoal?.(t("workspace.agentBar.empty.suggestQuiz")),
            },
            {
              id: "suggest-changelog",
              label: t("workspace.agentBar.empty.suggestChangelog"),
              onSelect: () => onSuggestGoal?.(t("workspace.agentBar.empty.suggestChangelog")),
            },
            {
              id: "suggest-reverse",
              label: t("workspace.agentBar.empty.suggestReverse"),
              onSelect: () => onSuggestReverse?.(),
              reverse: true,
            },
          ]}
        />
      </>
    );
  }

  if (phase === "reversing") {
    return (
      <>
        <Assistant>{t("workspace.agentBar.reversing.intro")}</Assistant>
        {reversingSteps && reversingSteps.length > 0 ? (
          <ProgressList items={reversingSteps} showStatus />
        ) : null}
      </>
    );
  }

  if (phase === "applied") {
    return <Assistant>{t("workspace.agentBar.applied.hint")}</Assistant>;
  }

  if (phase === "running") {
    return <>{runContent}</>;
  }

  if (phase === "done") {
    return <>{distillContent}</>;
  }

  return null;
};
