import { createFileRoute } from "@tanstack/react-router";
import { DistillationDetailPage } from "@/pages/DistillationDetailPage";

export const Route = createFileRoute("/_layout/distillations/$distillationId")({
  component: DistillationDetailPage,
});
