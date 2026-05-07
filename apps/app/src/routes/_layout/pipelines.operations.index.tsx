import { createFileRoute } from "@tanstack/react-router";
import { OperationsPage } from "@/pages/OperationsPage";

export const Route = createFileRoute("/_layout/pipelines/operations/")({
  component: OperationsPage,
});
