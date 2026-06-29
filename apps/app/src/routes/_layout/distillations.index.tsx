import { createFileRoute } from "@tanstack/react-router";
import { DistillationsPage } from "@repo/views/DistillationsPage";

export const Route = createFileRoute("/_layout/distillations/")({
  head: () => ({
    meta: [{ title: "Distillations | Ordine" }],
  }),
  component: DistillationsPage,
});
