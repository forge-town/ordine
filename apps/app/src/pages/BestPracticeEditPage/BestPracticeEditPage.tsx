import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/best-practices.$bestPracticeId.edit";
import { BestPracticeEditPageContent } from "./BestPracticeEditPageContent";

export const BestPracticeEditPage = () => {
  const { bestPractice, checklistItems, codeSnippets } = Route.useLoaderData();
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
