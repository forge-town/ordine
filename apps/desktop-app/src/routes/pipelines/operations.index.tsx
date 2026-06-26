import { createFileRoute } from "@tanstack/react-router";
import { OperationsPage } from "@repo/views/OperationsPage";

export const Route = createFileRoute("/pipelines/operations/")({
  component: OperationsPage,
});
