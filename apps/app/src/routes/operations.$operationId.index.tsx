import { createFileRoute } from "@tanstack/react-router";
import { OperationDetailPage } from "@/pages/OperationDetailPage";
import { getOperationById } from "@/services/operationsService";

export const Route = createFileRoute("/operations/$operationId/")({
  loader: ({ params }) => getOperationById({ data: { id: params.operationId } }),
  component: OperationDetailPage,
});
