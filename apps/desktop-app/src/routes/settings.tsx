import { createFileRoute } from "@tanstack/react-router";
import { DesktopSettingsPage } from "../components/DesktopSettingsPage";

export const Route = createFileRoute("/settings")({
  component: DesktopSettingsPage,
});
