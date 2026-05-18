import { createFileRoute } from "@tanstack/react-router";
import { OperationDetailPage } from "@/pages/OperationDetailPage";

export const Route = createFileRoute("/_layout/pipelines/operations/$operationId/")({
  component: OperationDetailPage,
});
