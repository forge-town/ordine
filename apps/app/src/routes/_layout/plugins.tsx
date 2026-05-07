import { createFileRoute } from "@tanstack/react-router";
import { PluginsPage } from "@/pages/PluginsPage";

export const Route = createFileRoute("/_layout/plugins")({
  component: PluginsPage,
});
