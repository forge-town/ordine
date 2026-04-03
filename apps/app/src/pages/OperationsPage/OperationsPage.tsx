import { useLoaderData } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { OperationsPageContent } from "./OperationsPageContent";
import type { OperationEntity } from "@/models/daos/operationsDao";

export const OperationsPage = () => {
  const operations = useLoaderData({
    from: "/operations/",
  }) as OperationEntity[];
  return (
    <AppLayout>
      <OperationsPageContent initialOperations={operations} />
    </AppLayout>
  );
};
