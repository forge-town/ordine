import { createFileRoute } from "@tanstack/react-router";
import { OperationEditPage } from "@repo/views/OperationEditPage";

export const Route = createFileRoute("/pipelines/operations/$operationId/edit")({
  component: OperationEditPage,
});
