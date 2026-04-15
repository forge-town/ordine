import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.edit";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { BestPracticeRecord, ChecklistItemRecord, CodeSnippetRecord } from "@repo/db-schema";
import { BestPracticeEditPageContent } from "./BestPracticeEditPageContent";

export const BestPracticeEditPage = () => {
  const { bestPracticeId } = Route.useParams();
  const { result: bpResult } = useOne<BestPracticeRecord>({
    resource: ResourceName.bestPractices,
    id: bestPracticeId,
  });
  const { result: checklistResult } = useList<ChecklistItemRecord>({
    resource: ResourceName.checklistItems,
    filters: [{ field: "bestPracticeId", operator: "eq", value: bestPracticeId }],
  });
  const { result: snippetsResult } = useList<CodeSnippetRecord>({
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
    <BestPracticeEditPageContent
      bestPractice={bestPractice}
      checklistItems={checklistItems}
      codeSnippets={codeSnippets}
    />
  );
};
