import { createFileRoute } from "@tanstack/react-router";
import { ComponentsPage } from "@repo/views/ComponentsPage";

export const Route = createFileRoute("/components")({
  component: ComponentsPage,
});
