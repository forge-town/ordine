import { AppLayout } from "@/components/AppLayout";
import { OperationEditPageContent } from "./OperationEditPageContent";
import { Route } from "@/routes/operations.$operationId.edit";
import type { OperationEntity } from "@/models/daos/operationsDao";

export const OperationEditPage = () => {
  const operation = Route.useLoaderData() as OperationEntity | null;

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
      <OperationEditPageContent operation={operation} />
    </AppLayout>
  );
};
