import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.index";
import { BestPracticeDetailPageContent } from "./BestPracticeDetailPageContent";

export const BestPracticeDetailPage = () => {
  const { bestPractice, checklistItems } = Route.useLoaderData();
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
    />
  );
};
