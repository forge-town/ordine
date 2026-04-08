import { AppLayout } from "@/components/AppLayout";
import { OperationEditPageContent } from "./OperationEditPageContent";
import { Route } from "@/routes/operations.$operationId.edit";
import type { SkillEntity } from "@/models/daos/skillsDao";

export const OperationEditPage = () => {
  const { operation, skills } = Route.useLoaderData() as {
    operation: import("@/models/daos/operationsDao").OperationEntity | null;
    skills: SkillEntity[];
  };

  if (!operation) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
          Operation 不存在
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <OperationEditPageContent operation={operation} skills={skills} />
    </AppLayout>
  );
};
