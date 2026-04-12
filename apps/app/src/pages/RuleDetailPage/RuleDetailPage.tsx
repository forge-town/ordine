import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/rules.$ruleId.index";
import { RuleDetailPageContent } from "./RuleDetailPageContent";

export const RuleDetailPage = () => {
  const rule = Route.useLoaderData();
  const { t } = useTranslation();

  if (!rule) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("rules.notFound")}
      </div>
    );
  }

  return <RuleDetailPageContent rule={rule} />;
};
