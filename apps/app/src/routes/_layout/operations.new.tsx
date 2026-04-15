import { createFileRoute } from "@tanstack/react-router";
import { OperationCreatePage } from "@/pages/OperationCreatePage";

export const Route = createFileRoute("/_layout/operations/new")({
  component: OperationCreatePage,
});
