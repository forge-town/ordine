import { createFileRoute } from "@tanstack/react-router";
import { ComponentsPage } from "@/pages/ComponentsPage";

export const Route = createFileRoute("/_layout/components")({
  head: () => ({
    meta: [{ title: "Components | Ordine" }],
  }),
  component: ComponentsPage,
});
