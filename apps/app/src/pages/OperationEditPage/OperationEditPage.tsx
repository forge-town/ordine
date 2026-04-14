import { useTranslation } from "react-i18next";
import { OperationEditPageContent } from "./OperationEditPageContent";
import { Route } from "@/routes/_layout/operations.$operationId.edit";
import type { SkillEntity, OperationEntity } from "@repo/models";

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
