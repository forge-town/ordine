import { createFileRoute } from "@tanstack/react-router";
import { OperationDetailPage } from "@repo/views/OperationDetailPage";

export const Route = createFileRoute("/pipelines/operations/$operationId/")({
  component: OperationDetailPage,
});
