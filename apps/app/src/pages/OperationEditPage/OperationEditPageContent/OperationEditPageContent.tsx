import { useList, useOne } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { Operation, Skill } from "@repo/schemas";
import { PageHeader } from "@/components/PageHeader";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/pipelines.operations.$operationId.edit";
import { OperationEditForm } from "./OperationEditForm";

export const OperationEditPageContent = () => {
  const { t } = useTranslation();
  const { operationId } = Route.useParams();
  const { result: operationResult, query: operationQuery } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });
  const { result: skillsResult, query: skillsQuery } = useList<Skill>({
    resource: ResourceName.skills,
  });

  if (operationQuery?.isLoading || skillsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("operations.editTitle")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!operationResult) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("operations.operationNotFound")}
      </div>
    );
  }

  return <OperationEditForm operation={operationResult} skills={skillsResult.data} />;
};
