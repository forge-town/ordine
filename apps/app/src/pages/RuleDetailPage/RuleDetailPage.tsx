import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/rules.$ruleId.index";
import { useOne } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { Rule } from "@repo/schemas";
import { RuleDetailPageContent } from "./RuleDetailPageContent";
import { PageLoadingState } from "@/components/PageLoadingState";

export const RuleDetailPage = () => {
  const { ruleId } = Route.useParams();
  const { result: ruleResult, query: ruleQuery } = useOne<Rule>({
    resource: ResourceName.rules,
    id: ruleId,
  });
  const rule = ruleResult ?? null;
  const { t } = useTranslation();

  if (ruleQuery?.isLoading) {
    return <PageLoadingState title={t("rules.title")} variant="detail" />;
  }

  if (!rule) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("rules.notFound")}
      </div>
    );
  }

  return <RuleDetailPageContent rule={rule} />;
};
