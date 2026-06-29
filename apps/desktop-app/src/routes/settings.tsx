import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@repo/views/SettingsPage";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
