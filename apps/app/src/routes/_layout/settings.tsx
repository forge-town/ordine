import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/pages/SettingsPage";

export const Route = createFileRoute("/_layout/settings")({
  head: () => ({
    meta: [{ title: "Settings | Ordine" }],
  }),
  component: SettingsPage,
});
