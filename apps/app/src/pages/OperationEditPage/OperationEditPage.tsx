import { useTranslation } from "react-i18next";
import { OperationEditPageContent } from "./OperationEditPageContent";
import { Route } from "@/routes/_layout/operations.$operationId.edit";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { SkillEntity, OperationEntity } from "@repo/models";

export const OperationEditPage = () => {
  const { operationId } = Route.useParams();
  const { result: operationResult } = useOne<OperationEntity>({
    resource: ResourceName.operations,
    id: operationId,
  });
  const { result: skillsResult } = useList<SkillEntity>({ resource: ResourceName.skills });
  const operation = operationResult ?? null;
  const skills = skillsResult?.data ?? [];
  const { t } = useTranslation();

  if (!operation) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("operations.operationNotFound")}
      </div>
    );
  }

  return <OperationEditPageContent operation={operation} skills={skills} />;
};
