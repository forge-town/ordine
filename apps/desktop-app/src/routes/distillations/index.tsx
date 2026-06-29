import { createFileRoute } from "@tanstack/react-router";
import { DistillationsPage } from "@repo/views/DistillationsPage";

export const Route = createFileRoute("/distillations/")({
  component: DistillationsPage,
});
