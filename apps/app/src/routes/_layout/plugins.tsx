import { createFileRoute } from "@tanstack/react-router";
import { PluginsPage } from "@repo/views/PluginsPage";

export const Route = createFileRoute("/_layout/plugins")({
  component: PluginsPage,
});
