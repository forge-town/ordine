import { useTranslation } from "react-i18next";
import { OperationEditPageContent } from "./OperationEditPageContent";
import { OperationEditPageStoreProvider } from "./_store";
import { Route } from "@/routes/_layout/operations.$operationId.edit";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { Skill, Operation } from "@repo/schemas";
import { PageLoadingState } from "@/components/PageLoadingState";

export const OperationEditPage = () => {
  const { operationId } = Route.useParams();
  const { result: operationResult, query: operationQuery } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });
  const { result: skillsResult, query: skillsQuery } = useList<Skill>({
    resource: ResourceName.skills,
  });
  const operation = operationResult ?? null;
  const skills = skillsResult?.data ?? [];
  const { t } = useTranslation();

  if (operationQuery?.isLoading || skillsQuery?.isLoading) {
    return <PageLoadingState title={t("operations.editTitle")} variant="detail" />;
  }

  if (!operation) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t("operations.operationNotFound")}
      </div>
    );
  }

  return (
    <OperationEditPageStoreProvider>
      <OperationEditPageContent operation={operation} skills={skills} />
    </OperationEditPageStoreProvider>
  );
};
