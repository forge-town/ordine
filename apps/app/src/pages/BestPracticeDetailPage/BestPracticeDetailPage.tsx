import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.index";
import { useOne } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { BestPracticeRecord } from "@repo/db-schema";
import { BestPracticeDetailPageContent } from "./BestPracticeDetailPageContent";

export const BestPracticeDetailPage = () => {
  const { bestPracticeId } = Route.useParams();
  const { result: bestPracticeResult } = useOne<BestPracticeRecord>({
    resource: ResourceName.bestPractices,
    id: bestPracticeId,
  });

  const { t } = useTranslation();

  if (!bestPracticeResult) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("bestPractices.notFound")}
      </div>
    );
  }

  return <BestPracticeDetailPageContent bestPractice={bestPracticeResult} />;
};
