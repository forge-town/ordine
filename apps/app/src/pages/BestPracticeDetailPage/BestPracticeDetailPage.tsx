import { useTranslation } from "react-i18next";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import type { ChecklistItemEntity } from "@/models/daos/checklistItemsDao";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.index";
import { BestPracticeDetailPageContent } from "./BestPracticeDetailPageContent";

export const BestPracticeDetailPage = () => {
  const { bestPractice, checklistItems } = Route.useLoaderData() as {
    bestPractice: BestPracticeEntity | null;
    checklistItems: ChecklistItemEntity[];
  };
  const { t } = useTranslation();

  if (!bestPractice) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("bestPractices.notFound")}
      </div>
    );
  }

  return (
    <BestPracticeDetailPageContent bestPractice={bestPractice} checklistItems={checklistItems} />
  );
};
