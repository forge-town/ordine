import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.edit";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { BestPractice, ChecklistItem, CodeSnippet } from "@repo/schemas";
import { BestPracticeEditPageContent } from "./BestPracticeEditPageContent";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";

export const BestPracticeEditPage = () => {
  const { bestPracticeId } = Route.useParams();
  const { result: bpResult, query: bpQuery } = useOne<BestPractice>({
    resource: ResourceName.bestPractices,
    id: bestPracticeId,
  });
  const { result: checklistResult, query: checklistQuery } = useList<ChecklistItem>({
    resource: ResourceName.checklistItems,
    filters: [{ field: "bestPracticeId", operator: "eq", value: bestPracticeId }],
  });
  const { result: snippetsResult, query: snippetsQuery } = useList<CodeSnippet>({
    resource: ResourceName.codeSnippets,
    filters: [{ field: "bestPracticeId", operator: "eq", value: bestPracticeId }],
  });
  const bestPractice = bpResult ?? null;
  const checklistItems = checklistResult?.data ?? [];
  const codeSnippets = snippetsResult?.data ?? [];
  const { t } = useTranslation();

  if (bpQuery?.isLoading || checklistQuery?.isLoading || snippetsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("bestPractices.title")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

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
