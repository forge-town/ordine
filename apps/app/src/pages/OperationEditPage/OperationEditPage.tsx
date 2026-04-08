import { useTranslation } from "react-i18next";
import { OperationEditPageContent } from "./OperationEditPageContent";
import { Route } from "@/routes/_layout/operations.$operationId.edit";
import type { SkillEntity } from "@/models/daos/skillsDao";
import type { OperationEntity } from "@/models/daos/operationsDao";

export const OperationEditPage = () => {
  const { operation, skills } = Route.useLoaderData() as {
    operation: OperationEntity | null;
    skills: SkillEntity[];
  };
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
