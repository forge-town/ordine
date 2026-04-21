import { createFileRoute } from "@tanstack/react-router";
import { OperationEditPage } from "@/pages/OperationEditPage";

export const Route = createFileRoute("/_layout/operations/$operationId/edit")({
  component: OperationEditPage,
});
