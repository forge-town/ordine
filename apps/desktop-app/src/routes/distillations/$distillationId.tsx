import { createFileRoute } from "@tanstack/react-router";
import { DistillationDetailPage } from "@repo/views/DistillationDetailPage";

export const Route = createFileRoute("/distillations/$distillationId")({
  component: DistillationDetailPage,
});
