import { createFileRoute } from "@tanstack/react-router";
import { OperationCreatePage } from "@repo/views/OperationCreatePage";

export const Route = createFileRoute("/pipelines/operations/new")({
  component: OperationCreatePage,
});
