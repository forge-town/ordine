import { createFileRoute } from "@tanstack/react-router";
import { OperationCreatePage } from "@/pages/OperationCreatePage";

export const Route = createFileRoute("/_layout/pipelines/operations/new")({
  component: OperationCreatePage,
});
