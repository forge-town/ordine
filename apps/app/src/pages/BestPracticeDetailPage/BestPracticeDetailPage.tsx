import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.index";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { BestPracticeRow, ChecklistItemRow, CodeSnippetRow } from "@repo/models";
import { BestPracticeDetailPageContent } from "./BestPracticeDetailPageContent";

export const BestPracticeDetailPage = () => {
  const { bestPracticeId } = Route.useParams();
  const { result: bpResult } = useOne<BestPracticeRow>({
    resource: ResourceName.bestPractices,
    id: bestPracticeId,
  });
  const { result: checklistResult } = useList<ChecklistItemRow>({
    resource: ResourceName.checklistItems,
    filters: [{ field: "bestPracticeId", operator: "eq", value: bestPracticeId }],
  });
  const { result: snippetsResult } = useList<CodeSnippetRow>({
    resource: ResourceName.codeSnippets,
    filters: [{ field: "bestPracticeId", operator: "eq", value: bestPracticeId }],
  });
  const bestPractice = bpResult ?? null;
  const checklistItems = checklistResult?.data ?? [];
  const codeSnippets = snippetsResult?.data ?? [];
  const { t } = useTranslation();

  if (!bestPractice) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("bestPractices.notFound")}
      </div>
    );
  }

  return (
    <BestPracticeDetailPageContent
      bestPractice={bestPractice}
      checklistItems={checklistItems}
      codeSnippets={codeSnippets}
    />
  );
};
