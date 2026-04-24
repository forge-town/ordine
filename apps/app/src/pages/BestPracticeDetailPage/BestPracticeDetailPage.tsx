import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.index";
import { useOne } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { BestPractice } from "@repo/schemas";
import { BestPracticeDetailPageContent } from "./BestPracticeDetailPageContent";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";

export const BestPracticeDetailPage = () => {
  const { bestPracticeId } = Route.useParams();
  const { result: bestPracticeResult, query: bestPracticeQuery } = useOne<BestPractice>({
    resource: ResourceName.bestPractices,
    id: bestPracticeId,
  });

  const { t } = useTranslation();

  if (bestPracticeQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("bestPractices.title")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!bestPracticeResult) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("bestPractices.notFound")}
      </div>
    );
  }

  return <BestPracticeDetailPageContent bestPractice={bestPracticeResult} />;
};
