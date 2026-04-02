import { createFileRoute } from "@tanstack/react-router";
import { OperationsPage } from "@/pages/OperationsPage";
import { getOperations } from "@/services/operationsService";

export const Route = createFileRoute("/operations")({
  loader: () => getOperations(),
  component: OperationsPage,
});
