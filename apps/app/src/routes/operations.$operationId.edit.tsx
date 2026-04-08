import { createFileRoute } from "@tanstack/react-router";
import { OperationEditPage } from "@/pages/OperationEditPage";
import { getOperationById } from "@/services/operationsService";

export const Route = createFileRoute("/operations/$operationId/edit")({
  loader: ({ params }) =>
    getOperationById({ data: { id: params.operationId } }),
  component: OperationEditPage,
});
