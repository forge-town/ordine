import { AppLayout } from "@/components/AppLayout";
import { OperationDetailPageContent } from "./OperationDetailPageContent";
import { Route } from "@/routes/operations.$operationId";
import type { OperationEntity } from "@/models/daos/operationsDao";

export const OperationDetailPage = () => {
  const operation = Route.useLoaderData() as OperationEntity | null;

  return (
    <AppLayout>
      <OperationDetailPageContent operation={operation} />
    </AppLayout>
  );
};
