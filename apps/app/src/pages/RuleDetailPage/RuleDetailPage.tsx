import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/rules.$ruleId.index";
import { useOne } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { RuleEntity } from "@repo/models";
import { RuleDetailPageContent } from "./RuleDetailPageContent";

export const RuleDetailPage = () => {
  const { ruleId } = Route.useParams();
  const { result: ruleResult } = useOne<RuleEntity>({ resource: ResourceName.rules, id: ruleId });
  const rule = ruleResult ?? null;
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
