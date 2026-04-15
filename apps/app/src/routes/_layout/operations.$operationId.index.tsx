import { createFileRoute } from "@tanstack/react-router";
import { OperationDetailPage } from "@/pages/OperationDetailPage";

export const Route = createFileRoute("/_layout/operations/$operationId/")({
  component: OperationDetailPage,
});
