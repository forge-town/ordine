import { createFileRoute } from "@tanstack/react-router";
import { DistillationDetailPage } from "@repo/views/DistillationDetailPage";

export const Route = createFileRoute("/_layout/distillations/$distillationId")({
  component: DistillationDetailPage,
});
